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
        briefing: null,
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
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const dayOfWeek = today.toLocaleDateString("en-US", { weekday: "long" });
    const dateFormatted = today.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

    // Calculate key metrics from data
    const incomeTransactions = transactions?.filter((t: Record<string, unknown>) => Number(t.amount) > 0) ?? [];
    const expenseTransactions = transactions?.filter((t: Record<string, unknown>) => Number(t.amount) < 0) ?? [];
    const totalIncome = incomeTransactions.reduce((sum: number, t: Record<string, unknown>) => sum + Number(t.amount), 0);
    const totalExpenses = Math.abs(expenseTransactions.reduce((sum: number, t: Record<string, unknown>) => sum + Number(t.amount), 0));
    const overdueInvoices = invoices?.filter((i: Record<string, unknown>) => i.status === "overdue") ?? [];
    const totalOverdue = overdueInvoices.reduce((sum: number, i: Record<string, unknown>) => sum + Number(i.amount), 0);

    const prompt = `You are a trusted financial advisor writing a personalized weekly briefing for a freelancer/SMB owner. Write in the tone of a business partner who knows this person well — warm, direct, never condescending, always specific with dollar amounts.

TODAY'S DATE: ${dateFormatted} (${dayOfWeek})
WEEK: ${todayStr}

FINANCIAL DATA SUMMARY:
- Total income (from transactions): $${totalIncome.toFixed(2)}
- Total expenses (from transactions): $${totalExpenses.toFixed(2)}
- Net position: $${(totalIncome - totalExpenses).toFixed(2)}
- Overdue invoices: ${overdueInvoices.length} totaling $${totalOverdue.toFixed(2)}

RECENT TRANSACTIONS (last 30):
${JSON.stringify(transactions?.slice(0, 30) ?? [], null, 2)}

INVOICES:
${JSON.stringify(invoices ?? [], null, 2)}

Generate a weekly financial briefing. Return a JSON object with:

1. "briefing": Object with:
   - "greeting": A warm, personalized opening line (e.g., "Good morning — here's where you stand this week.")
   - "current_status": 2-3 sentences summarizing the current financial position with specific dollar amounts. Lead with the most important number.
   - "top_concern": Object with:
     - "title": Short headline for the #1 concern (e.g., "Overdue Invoice Alert")
     - "detail": 2-3 sentences explaining the concern with specific dollar amounts, client names, and days overdue
     - "impact": Dollar impact if not addressed
   - "recommended_action": Object with:
     - "title": Short action headline (e.g., "Chase TechCorp's $4,500 Invoice")
     - "steps": Array of 2-3 specific action steps (not generic advice — specific to this person's data)
     - "deadline": When to complete by
   - "forward_look": Object with:
     - "title": "Next 14 Days"
     - "detail": 2-3 sentences about what's coming in the next 2 weeks — expected income, upcoming expenses, any risks
   - "positive_close": Object with:
     - "title": Short positive headline (e.g., "Revenue Up 12% This Month")
     - "detail": 1-2 sentences highlighting something positive — a paid invoice, revenue growth, expense reduction, or healthy trend
   - "full_narrative": The COMPLETE briefing as a single plain-English narrative, 250-350 words. This should flow naturally as one cohesive piece combining all the sections above. No headers, no bullet points — just clear, warm prose. Written in second person ("you"). Every figure mentioned must be in USD. No financial jargon (no EBITDA, amortization, liquidity ratio, accounts receivable aging, etc.).

2. "metadata": Object with:
   - "generated_date": "${todayStr}"
   - "word_count": Word count of full_narrative (must be 250-350)
   - "data_freshness": Description of data recency
   - "key_metrics": Object with:
     - "total_receivables": Total outstanding invoices
     - "overdue_amount": Total overdue amount
     - "monthly_income_trend": "up", "down", or "stable"
     - "cash_position": Current estimated cash position
   - "tone_check": "warm_and_direct" (confirm tone)

CRITICAL RULES:
- The full_narrative MUST be 250-350 words. Count carefully.
- Never use financial jargon. Write in plain English.
- Be specific with dollar amounts, client names, and dates.
- Every recommendation must be actionable and specific to the data.
- Tone: trusted advisor, not a robot. Warm but direct.
- Write in second person ("you", "your").
- Do not use bullet points or headers in the narrative.

Return ONLY valid JSON. No markdown fences. No extra text.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const rawText = textBlock?.text ?? "{}";

    let briefing;
    try {
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawText.trim();
      briefing = JSON.parse(jsonStr);
    } catch {
      briefing = { raw_analysis: rawText };
    }

    return NextResponse.json({ briefing });
  } catch (err) {
    console.error("[briefing] Unhandled error:", err);
    return NextResponse.json(
      {
        error: "Briefing generation failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
