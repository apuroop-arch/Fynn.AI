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
      .eq("user_id", userId);

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
        analysis: null,
        message: "No data found. Please upload transactions or invoices first.",
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

    const prompt = `You are a financial analyst specializing in profitability analysis for businesses of all sizes — freelancers, agencies, SMBs, and mid-market companies. Analyze the following data and rank clients/revenue streams by true profitability.

TODAY'S DATE: ${today}

TRANSACTIONS (income and expenses):
${JSON.stringify(transactions?.slice(0, 200) ?? [], null, 2)}

INVOICES:
${JSON.stringify(invoices ?? [], null, 2)}

Perform a comprehensive client profitability analysis. Return a JSON object with these fields:

1. "clients": An array of client objects, each with:
   - "name": Client name
   - "gross_revenue": Total invoiced/received amount
   - "paid_amount": Amount actually received
   - "outstanding": Unpaid amount
   - "avg_days_to_pay": Average days from invoice date to payment (estimate from data)
   - "payment_delay_cost": Cost of payment delays (outstanding × 8% annual / 365 × days_overdue)
   - "true_profit": gross_revenue - payment_delay_cost - estimated overhead
   - "true_profit_margin": true_profit / gross_revenue as percentage (0-100)
   - "health_score": 1-100 composite score based on: payment reliability (40%), revenue trend (30%), margin trend (30%)
   - "health_status": "healthy" if score >= 70, "watch" if 40-69, "at_risk" if < 40
   - "risk_factors": Array of specific risk strings (e.g., "Payment 45 days late on average", "Revenue declining 2 months")
   - "gross_rank": Rank by gross revenue (1 = highest)
   - "profit_rank": Rank by true profit (1 = highest)
   - "rank_delta": gross_rank - profit_rank (positive = more profitable than they appear)

2. "firing_recommendations": Array of clients meeting ALL three criteria:
   - true_profit_margin < 30%
   - health_score < 40
   - Revenue declined for 2+ months
   Each object: { "name", "reason", "hours_freed_estimate", "monthly_value_if_redeployed", "recommendation" }

3. "summary": Object with:
   - "total_clients": number
   - "total_gross_revenue": number
   - "total_true_profit": number
   - "avg_health_score": number
   - "top_3_clients": array of names generating 80%+ of true profit
   - "at_risk_count": number of clients with health_score < 40
   - "key_insight": One sentence insight about the client portfolio

Sort the clients array by true_profit descending (most profitable first).
Return ONLY valid JSON. No markdown fences. No extra text.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

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
    console.error("[profitability] Unhandled error:", err);
    return NextResponse.json(
      {
        error: "Profitability analysis failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

