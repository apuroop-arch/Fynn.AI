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

    const prompt = `You are a tax planning specialist for freelancers and SMBs. Analyze the following financial data and calculate estimated tax reserves with DETAILED bracket-by-bracket breakdowns.

TODAY'S DATE: ${today}
TAX YEAR: ${currentYear}

TRANSACTIONS (most recent first):
${JSON.stringify(transactions?.slice(0, 200) ?? [], null, 2)}

INVOICES:
${JSON.stringify(invoices ?? [], null, 2)}

Calculate quarterly estimated tax obligations with full transparency on how every number is derived. Return a JSON object with:

1. "income_summary": Object with:
   - "gross_income_ytd": Total income received year-to-date
   - "total_expenses_ytd": Total business expenses year-to-date
   - "net_income_ytd": gross_income - total_expenses
   - "projected_annual_income": Projected annual income based on YTD trend
   - "projected_annual_expenses": Projected annual expenses
   - "projected_net_income": Projected annual net income
   - "months_of_data": Number of months of transaction data available
   - "projection_method": Brief explanation of how annual projection was calculated (e.g., "Based on 3 months of data, annualized by multiplying by 4")

2. "deductions": Array of identified deductible expense categories, each with:
   - "category": Category name (e.g., "Software & Subscriptions", "Office/Coworking", "Professional Services", "Cloud & Hosting")
   - "amount_ytd": Amount spent YTD in this category
   - "projected_annual": Projected annual amount
   - "confidence": "high", "medium", or "low"
   - "items": Array of specific transactions in this category (top 3-5 items) each with "name" and "amount"

3. "tax_calculation_steps": This is the CRITICAL section. Show the full step-by-step calculation. Object with:
   - "step_1_gross_income": { "description": "Total projected annual income", "amount": number }
   - "step_2_deductions": { "description": "Total deductible business expenses", "amount": number, "items_summary": "Brief list of categories" }
   - "step_3_net_self_employment_income": { "description": "Gross - Deductions", "amount": number, "formula": "step1 - step2 = result" }
   - "step_4_se_tax_base": { "description": "92.35% of net SE income (IRS rule)", "amount": number, "formula": "net_income × 0.9235 = result" }
   - "step_5_se_tax": { "description": "Self-employment tax at 15.3%", "amount": number, "formula": "se_base × 0.153 = result", "social_security": number, "social_security_formula": "se_base × 0.124 = result (capped at $168,600 for 2025)", "medicare": number, "medicare_formula": "se_base × 0.029 = result" }
   - "step_6_se_deduction": { "description": "Deductible half of SE tax", "amount": number, "formula": "se_tax × 0.5 = result" }
   - "step_7_adjusted_gross_income": { "description": "AGI after SE deduction", "amount": number, "formula": "net_income - se_deduction = result" }
   - "step_8_standard_deduction": { "description": "Standard deduction for single filer", "amount": 15000, "note": "Using $15,000 estimate for ${currentYear} single filer" }
   - "step_9_taxable_income": { "description": "Income subject to federal tax", "amount": number, "formula": "AGI - standard_deduction = result" }
   - "step_10_federal_tax_brackets": Array of bracket objects, each with:
       - "bracket": "10%", "12%", "22%", "24%", "32%", "35%", or "37%"
       - "range_low": number
       - "range_high": number or "and above"
       - "taxable_in_bracket": Amount of income taxed in this bracket
       - "tax_from_bracket": Tax calculated for this bracket
       - "formula": "taxable_amount × rate = tax" (e.g., "$11,925 × 10% = $1,192")
   - "step_11_total_federal_income_tax": { "description": "Sum of all bracket taxes", "amount": number }
   - "step_12_total_tax": { "description": "Federal income tax + SE tax", "amount": number, "formula": "income_tax + se_tax = result", "effective_rate": number, "effective_rate_formula": "total_tax / net_income × 100 = rate%" }

4. "tax_estimates": Object with:
   - "us_federal": Object with:
     - "taxable_income": From step 9
     - "estimated_tax": Federal income tax from step 11
     - "self_employment_tax": From step 5
     - "total_federal": From step 12
     - "effective_rate": Effective rate from step 12
   - "quarterly_payment": total_federal / 4
   - "monthly_reserve": total_federal / 12

5. "quarterly_schedule": Array of 4 objects for Q1-Q4, each with:
   - "quarter": "Q1", "Q2", "Q3", or "Q4"
   - "due_date": IRS quarterly due date for ${currentYear} (Apr 15, Jun 16, Sep 15, Jan 15 next year)
   - "amount_due": Quarterly payment amount
   - "status": "paid", "upcoming", or "overdue" based on today's date
   - "days_until_due": Days until due (negative if overdue, null if paid)

6. "reserve_status": Object with:
   - "recommended_reserve": Total amount that should be set aside right now
   - "current_quarter": Which quarter we're currently in
   - "next_payment_date": Next quarterly payment due date
   - "next_payment_amount": Amount due for next quarterly payment
   - "months_of_data": How many months of transaction data we have
   - "confidence_level": "high" (6+ months data), "medium" (3-6 months), "low" (<3 months)

7. "optimization_tips": Array of 3-5 tax-saving recommendations, each with:
   - "tip": Specific actionable recommendation
   - "potential_savings": Estimated dollar savings
   - "category": "deduction", "timing", "structure", or "retirement"
   - "priority": "high", "medium", or "low"

8. "summary": Object with:
   - "headline": One-sentence tax position summary
   - "monthly_set_aside": How much to set aside each month
   - "risk_level": "on_track", "underpaid", or "overpaid"
   - "total_tax_burden_pct": Effective total tax rate as percentage

CRITICAL: Use the actual 2025 US federal tax brackets for single filers:
- 10%: $0 - $11,925
- 12%: $11,926 - $48,475
- 22%: $48,476 - $103,350
- 24%: $103,351 - $197,300
- 32%: $197,301 - $250,525
- 35%: $250,526 - $626,350
- 37%: Over $626,350

Self-employment tax: 15.3% (12.4% Social Security + 2.9% Medicare) on 92.35% of net SE income.
Social Security wage base cap: $168,600 for 2025.

Show every calculation step clearly so users can verify the math.
Return ONLY valid JSON. No markdown fences. No extra text.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 6000,
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
