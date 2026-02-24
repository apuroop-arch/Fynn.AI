import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  try {
    // ── Step 1: Auth ──
    const { userId } = await auth();
    console.log("[leakage] Step 1 — Clerk userId:", userId);

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Step 2: Fetch transactions ──
    const supabaseAdmin = createAdminClient();
    console.log("[leakage] Step 2 — Querying transactions for user_id:", userId);

    const { data: transactions, error: txError } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("user_id", userId);

    console.log("[leakage] Step 2 result — txError:", txError ?? "none", "| rows:", transactions?.length ?? 0);

    if (txError) {
      return NextResponse.json(
        { error: "Failed to fetch transactions", detail: txError.message },
        { status: 500 }
      );
    }

    // ── Step 3: Fetch invoices ──
    console.log("[leakage] Step 3 — Querying invoices for user_id:", userId);

    const { data: invoices, error: invError } = await supabaseAdmin
      .from("invoices")
      .select("*")
      .eq("user_id", userId);

    console.log("[leakage] Step 3 result — invError:", invError ?? "none", "| rows:", invoices?.length ?? 0);

    if (invError) {
      return NextResponse.json(
        { error: "Failed to fetch invoices", detail: invError.message },
        { status: 500 }
      );
    }

    // ── Step 4: Check if there's any data ──
    if (
      (!transactions || transactions.length === 0) &&
      (!invoices || invoices.length === 0)
    ) {
      console.log("[leakage] Step 4 — No data found, returning friendly message");
      return NextResponse.json({
        analysis: null,
        message: "No transactions found. Please upload your bank statement first.",
      });
    }

    console.log("[leakage] Step 4 — Data found:", {
      transactions: transactions?.length ?? 0,
      invoices: invoices?.length ?? 0,
    });

    // ── Step 5: Verify Anthropic API key ──
    const apiKey = process.env.ANTHROPIC_API_KEY;
    console.log("[leakage] Step 5 — ANTHROPIC_API_KEY present:", !!apiKey, "| prefix:", apiKey?.slice(0, 12) ?? "NOT SET");

    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured on the server" },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({ apiKey });

    // ── Step 6: Quick API key validation ──
    console.log("[leakage] Step 6 — Testing Anthropic API key with a simple call...");
    try {
      const testResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 20,
        messages: [{ role: "user", content: "Reply with just the word OK" }],
      });
      const testText = testResponse.content.find((b) => b.type === "text");
      console.log("[leakage] Step 6 — API key works. Test response:", testText?.text);
    } catch (testErr) {
      console.error("[leakage] Step 6 — Anthropic API key test FAILED:", testErr);
      return NextResponse.json(
        {
          error: "Anthropic API key is invalid or request failed",
          detail: testErr instanceof Error ? testErr.message : String(testErr),
        },
        { status: 500 }
      );
    }

    // ── Step 7: Run the real analysis ──
    console.log("[leakage] Step 7 — Sending analysis prompt to Claude...");
    const today = new Date().toISOString().split("T")[0];

    const prompt = `You are a financial analyst for a freelancer/SMB. Analyze the following financial data and identify revenue leakage.

TODAY'S DATE: ${today}

TRANSACTIONS (most recent first):
${JSON.stringify(transactions?.slice(0, 200) ?? [], null, 2)}

INVOICES:
${JSON.stringify(invoices ?? [], null, 2)}

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

    let response;
    try {
      response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      });
      console.log("[leakage] Step 7 — Claude response received. Content blocks:", response.content.length);
    } catch (aiErr) {
      console.error("[leakage] Step 7 — Anthropic analysis call FAILED:", aiErr);
      return NextResponse.json(
        {
          error: "AI analysis request failed",
          detail: aiErr instanceof Error ? aiErr.message : String(aiErr),
        },
        { status: 500 }
      );
    }

    // ── Step 8: Parse the AI response ──
    const textBlock = response.content.find((block) => block.type === "text");
    const rawText = textBlock?.text ?? "{}";
    console.log("[leakage] Step 8 — Raw response length:", rawText.length, "chars");

    let analysis;
    try {
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawText.trim();
      analysis = JSON.parse(jsonStr);
      console.log("[leakage] Step 8 — JSON parsed successfully. Keys:", Object.keys(analysis));
    } catch {
      console.log("[leakage] Step 8 — JSON parse failed, returning raw text");
      analysis = { raw_analysis: rawText };
    }

    console.log("[leakage] Done — returning analysis");
    return NextResponse.json({ analysis });
  } catch (err) {
    console.error("[leakage] UNHANDLED ERROR:", err);
    return NextResponse.json(
      {
        error: "Leakage analysis failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
