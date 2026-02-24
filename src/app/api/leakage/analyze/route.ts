import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

const anthropic = new Anthropic();

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Transactions now use Clerk userId directly
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false });

    if (txError) {
      return NextResponse.json(
        { error: "Failed to fetch transactions" },
        { status: 500 }
      );
    }

    // Invoices still use users table FK — look up user first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let invoices: any[] = [];
    const { data: userRow } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_user_id", userId)
      .maybeSingle();

    if (userRow) {
      const { data: invData } = await supabase
        .from("invoices")
        .select("*")
        .eq("user_id", userRow.id);
      invoices = invData ?? [];
    }

    if (
      (!transactions || transactions.length === 0) &&
      invoices.length === 0
    ) {
      return NextResponse.json({
        analysis: null,
        message:
          "No transactions or invoices found. Upload data to begin analysis.",
      });
    }

    const today = new Date().toISOString().split("T")[0];

    const prompt = `You are a financial analyst for a freelancer/SMB. Analyze the following financial data and identify revenue leakage.

TODAY'S DATE: ${today}

TRANSACTIONS (most recent first):
${JSON.stringify(transactions?.slice(0, 200) ?? [], null, 2)}

INVOICES:
${JSON.stringify(invoices, null, 2)}

Perform the following analysis and return a JSON object:

1. **unpaid_invoices**: Group unpaid/overdue invoices by aging bucket (0-30 days, 31-60 days, 61-90 days, 90+ days). For each bucket, list invoice IDs, client names, amounts, and days overdue.

2. **inactive_subscriptions**: Identify any recurring charges (subscriptions) in transactions that have had no corresponding activity or revenue in the last 60 days. Flag them with the charge amount and last activity date.

3. **duplicate_charges**: Detect potential duplicate charges — transactions with the same amount and similar descriptions within a 7-day window.

4. **summary**: Provide a summary object with:
   - total_leakage_identified: total dollar amount of all identified leakage
   - unpaid_invoice_total: total unpaid invoice amount
   - inactive_subscription_total: monthly cost of inactive subscriptions
   - duplicate_charge_total: total duplicate charges
   - top_recommendations: array of 3 specific, actionable recommendations

Return ONLY valid JSON matching this structure. All dollar amounts should be numbers, not strings.`;

    const stream = anthropic.messages.stream({
      model: "claude-opus-4-6",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: prompt }],
    });

    const response = await stream.finalMessage();

    const textBlock = response.content.find((block) => block.type === "text");
    const rawText = textBlock?.text ?? "{}";

    let analysis;
    try {
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawText.trim();
      analysis = JSON.parse(jsonStr);
    } catch {
      analysis = { raw_analysis: rawText };
    }

    return NextResponse.json({ analysis });
  } catch (err) {
    console.error("[leakage] Unhandled error:", err);
    return NextResponse.json(
      {
        error: "Internal server error",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
