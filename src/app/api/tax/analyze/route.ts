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
        tax: null,
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
    const currentYear = new Date().getFullYear();

    const prompt = `You are a tax planning specialist for freelancers and SMBs. Analyze the following financial data and calculate estimated tax reserves.

TODAY'S DATE: ${today}
TAX YEAR: ${currentYear}

TRANSACTIONS (most recent first):
${JSON.stringify(transactions?.slice(0, 200) ?? [], null, 2)}

INVOICES:
${JSON.stringify(invoices ?? [], null, 2)}

Calculate quarterly estimated tax obligations. Return a JSON object with:

1. "income_summary": Object with:
   - "gross_income_ytd": Total income received year-to-date
   - "total_expenses_ytd": Total business expenses year-to-date
   - "net_income_ytd": gross_income - total_expenses
   - "projected_annual_income": Projected annual income based on YTD trend
   - "projected_annual_expenses": Projected annual expenses
   - "projected_net_income": Projected annual net income

2. "deductions": Array of identified deductible expense categories, each with:
   - "category": Category name (e.g., "Software & Subscriptions", "Office/Coworking", "Professional Services", "Cloud & Hosting", "Marketing", "Travel", "Equipment")
   - "amount_ytd": Amount spent YTD in this category
   - "projected_annual": Projected annual amount
   - "confidence": "high", "medium", or "low" (how confident the categorization is)

3. "tax_estimates": Object with:
   - "us_federal": Object with:
     - "taxable_income": projected_net_income minus standard/estimated deductions
     - "estimated_tax": Federal income tax estimate using 2024 brackets for self-employed
     - "self_employment_tax": 15.3% of 92.35% of net self-employment income
     - "total_federal": estimated_tax + self_employment_tax
     - "effective_rate": total_federal / projected_net_income as percentage
   - "quarterly_payment": total_federal / 4
   - "monthly_reserve": total_federal / 12

4. "quarterly_schedule": Array of 4 objects for Q1-Q4, each with:
   - "quarter": "Q1", "Q2", "Q3", or "Q4"
   - "due_date": IRS quarterly due date for ${currentYear} (Apr 15, Jun 16, Sep 15, Jan 15 next year)
   - "amount_due": Quarterly payment amount
   - "status": "paid", "upcoming", or "overdue" based on today's date
   - "days_until_due": Days until due (negative if overdue, null if paid)

5. "reserve_status": Object with:
   - "recommended_reserve": Total amount that should be set aside right now
   - "current_quarter": Which quarter we're currently in
   - "next_payment_date": Next quarterly payment due date
   - "next_payment_amount": Amount due for next quarterly payment
   - "months_of_data": How many months of transaction data we have
   - "confidence_level": "high" (6+ months data), "medium" (3-6 months), "low" (<3 months)

6. "optimization_tips": Array of 3-5 tax-saving recommendations, each with:
   - "tip": Specific actionable recommendation
   - "potential_savings": Estimated dollar savings
   - "category": "deduction", "timing", "structure", or "retirement"
   - "priority": "high", "medium", or "low"

7. "summary": Object with:
   - "headline": One-sentence tax position summary
   - "monthly_set_aside": How much to set aside each month
   - "risk_level": "on_track", "underpaid", or "overpaid"
   - "total_tax_burden_pct": Effective total tax rate as percentage

IMPORTANT: Include standard disclaimer that this is an estimate for planning purposes only, not professional tax advice.

Base all calculations on actual transaction data. Use current US federal tax brackets for self-employed individuals.
Return ONLY valid JSON. No markdown fences. No extra text.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const rawText = textBlock?.text ?? "{}";

    let tax;
    try {
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawText.trim();
      tax = JSON.parse(jsonStr);
    } catch {
      tax = { raw_analysis: rawText };
    }

    return NextResponse.json({ tax });
  } catch (err) {
    console.error("[tax] Unhandled error:", err);
    return NextResponse.json(
      {
        error: "Tax calculation failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
