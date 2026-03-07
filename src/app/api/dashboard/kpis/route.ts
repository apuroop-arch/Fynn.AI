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
      .select("amount, type, currency, description, date")
      .eq("user_id", userId);

    if (txError) {
      console.error("[kpis] transactions query error:", txError);
      return NextResponse.json(
        { error: "Failed to fetch transactions", detail: txError.message },
        { status: 500 }
      );
    }

    // Fetch invoices (for Total Recovered only)
    const { data: invoices, error: invError } = await supabase
      .from("invoices")
      .select("amount, paid_amount, status")
      .eq("user_id", userId);

    if (invError) {
      console.error("[kpis] invoices query error:", invError);
    }

    const txList = transactions ?? [];
    const invList = invoices ?? [];

    // ── Cash Position: total credits minus total debits ──────────────
    const totalCredits = txList
      .filter((t) => t.type === "credit")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const totalDebits = txList
      .filter((t) => t.type === "debit")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const cashPosition = totalCredits - totalDebits;

    // ── Total Leakage: detected from transactions ────────────────────
    // Leakage = recurring small debits (subscriptions, fees, duplicate charges)
    // Logic: group debits by description similarity, flag those appearing 2+ times
    // with similar amounts as potential leakage
    const debitTx = txList.filter((t) => t.type === "debit");

    // Group by normalised description (first 40 chars, lowercase)
    const descGroups: Record<string, number[]> = {};
    for (const t of debitTx) {
      const key = (t.description ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .slice(0, 40)
        .trim();
      if (!key) continue;
      if (!descGroups[key]) descGroups[key] = [];
      descGroups[key].push(Number(t.amount));
    }

    // Leakage = sum of amounts from recurring debit groups (2+ occurrences)
    // that are under ₹50,000 (likely subscriptions/fees, not salary/rent)
    let totalLeakage = 0;
    for (const [, amounts] of Object.entries(descGroups)) {
      if (amounts.length >= 2) {
        const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        if (avg <= 50000) {
          totalLeakage += amounts.reduce((a, b) => a + b, 0);
        }
      }
    }

    // ── Total Recovered: from invoices paid ─────────────────────────
    const totalRecovered = invList
      .reduce((sum, inv) => sum + Number(inv.paid_amount ?? 0), 0);

    // ── Tax Reserve: 25% of net income ──────────────────────────────
    const netIncome = totalCredits - totalDebits;
    const taxReserve = netIncome > 0 ? netIncome * 0.25 : 0;

    // ── Primary currency from transactions ──────────────────────────
    const currency = txList[0]?.currency ?? "INR";

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
