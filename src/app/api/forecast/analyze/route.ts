import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Fetch transactions
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false });

    if (txError) {
      return NextResponse.json(
        { error: "Failed to fetch transactions", detail: txError.message },
        { status: 500 }
      );
    }

    // Fetch invoices
    const { data: invoices, error: invError } = await supabase
      .from("invoices")
      .select("*")
      .eq("user_id", userId);

    if (invError) {
      return NextResponse.json(
        { error: "Failed to fetch invoices", detail: invError.message },
        { status: 500 }
      );
    }

    if (
      (!transactions || transactions.length === 0) &&
      (!invoices || invoices.length === 0)
    ) {
      return NextResponse.json({
        forecast: null,
        message: "No data found. Please upload transactions first.",
      });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({ apiKey });
    const today = new Date().toISOString().split("T")[0];

    const prompt = `You are a financial forecasting analyst for freelancers and SMBs. Analyze the following financial data and generate a 90-day cash flow forecast.

TODAY'S DATE: ${today}

TRANSACTIONS (most recent first):
${JSON.stringify(transactions?.slice(0, 200) ?? [], null, 2)}

INVOICES:
${JSON.stringify(invoices ?? [], null, 2)}

Generate a 90-day cash flow forecast. Return a JSON object with:

1. "weekly_forecast": Array of 13 objects (one per week for ~90 days), each with:
   - "week": Week number (1-13)
   - "week_start": Date string (YYYY-MM-DD)
   - "week_end": Date string (YYYY-MM-DD)
   - "optimistic": Projected balance (90th percentile)
   - "realistic": Projected balance (50th percentile)
   - "worst_case": Projected balance (10th percentile)
   - "expected_income": Estimated income for this week
   - "expected_expenses": Estimated expenses for this week
   - "key_event": Brief note about significant event this week or null

2. "current_position": Object with:
   - "cash_balance": Estimated current cash based on recent transactions
   - "outstanding_receivables": Total unpaid invoices
   - "monthly_burn_rate": Average monthly expenses from transaction history
   - "months_runway": cash_balance / monthly_burn_rate

3. "safety_analysis": Object with:
   - "safety_threshold": 2x average monthly expenses
   - "breach_week": Week number where realistic scenario drops below safety threshold (null if never)
   - "breach_date": Date when breach occurs (null if never)
   - "days_until_breach": Number of days until breach (null if never)

4. "scenarios": Object with:
   - "optimistic_summary": One sentence summary of best case
   - "realistic_summary": One sentence summary of expected case
   - "worst_case_summary": One sentence summary of worst case

5. "action_items": Array of 3-5 specific recommendations. Each with:
   - "priority": "high", "medium", or "low"
   - "action": Specific action to take
   - "impact": Dollar impact estimate
   - "deadline": Suggested deadline

6. "summary": Object with:
   - "outlook": "positive", "neutral", or "concerning"
   - "headline": One sentence cash position headline
   - "net_cash_flow_30d": Projected net cash flow next 30 days (realistic)
   - "net_cash_flow_90d": Projected net cash flow next 90 days (realistic)

Base all projections on actual patterns from the transaction data. Use realistic assumptions.
Return ONLY valid JSON. No markdown fences. No extra text.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const rawText = textBlock?.text ?? "{}";

    let forecast;
    try {
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawText.trim();
      forecast = JSON.parse(jsonStr);
    } catch {
      forecast = { raw_analysis: rawText };
    }

    return NextResponse.json({ forecast });
  } catch (err) {
    console.error("[forecast] Unhandled error:", err);
    return NextResponse.json(
      {
        error: "Cash forecast failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
