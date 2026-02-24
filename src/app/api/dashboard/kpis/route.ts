import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Fetch all transactions for this user
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("amount, type, currency")
      .eq("user_id", userId);

    if (txError) {
      console.error("[kpis] transactions query error:", txError);
      return NextResponse.json(
        { error: "Failed to fetch transactions", detail: txError.message },
        { status: 500 }
      );
    }

    // Fetch invoices
    const { data: invoices, error: invError } = await supabase
      .from("invoices")
      .select("amount, paid_amount, status")
      .eq("user_id", userId);

    if (invError) {
      console.error("[kpis] invoices query error:", invError);
      // Non-fatal — continue with transaction data
    }

    const txList = transactions ?? [];
    const invList = invoices ?? [];

    // Cash Position: total credits minus total debits
    const totalCredits = txList
      .filter((t) => t.type === "credit")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const totalDebits = txList
      .filter((t) => t.type === "debit")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const cashPosition = totalCredits - totalDebits;

    // Total Leakage: sum of unpaid/overdue invoice amounts
    const totalLeakage = invList
      .filter((inv) => inv.status === "unpaid" || inv.status === "overdue")
      .reduce((sum, inv) => sum + (Number(inv.amount) - Number(inv.paid_amount)), 0);

    // Total Recovered: sum of paid amounts on invoices that were at some point outstanding
    const totalRecovered = invList
      .reduce((sum, inv) => sum + Number(inv.paid_amount), 0);

    // Tax Reserve: estimate 25% of net income
    const netIncome = totalCredits - totalDebits;
    const taxReserve = netIncome > 0 ? netIncome * 0.25 : 0;

    // Determine primary currency
    const currency = txList[0]?.currency ?? "USD";

    return NextResponse.json({
      cashPosition,
      totalLeakage,
      totalRecovered,
      taxReserve,
      currency,
      transactionCount: txList.length,
    });
  } catch (err) {
    console.error("[kpis] Unhandled error:", err);
    return NextResponse.json(
      {
        error: "Failed to compute KPIs",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
