import { auth, currentUser } from "@clerk/nextjs/server";
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

    // Get user name from Clerk directly
    const clerkUser = await currentUser();
    const userName = clerkUser
      ? [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || "Business Owner"
      : "Business Owner";

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .gte("date", thirtyDaysAgo)
      .order("date", { ascending: false });

    if (txError) {
      console.error("[briefing] transactions query error:", txError);
      return NextResponse.json(
        { error: "Failed to fetch transactions", detail: txError.message },
        { status: 500 }
      );
    }

    const { data: invoices, error: invError } = await supabase
      .from("invoices")
      .select("*")
      .eq("user_id", userId);

    if (invError) {
      console.error("[briefing] invoices query error:", invError);
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
        message: "No financial data available for briefing.",
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
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1);

    const prompt = `You are a financial advisor writing a personalized weekly briefing for a freelancer/SMB owner.

RECIPIENT: ${userName}
WEEK OF: ${weekStart.toISOString().split("T")[0]}

RECENT TRANSACTIONS (last 30 days):
${JSON.stringify(transactions?.slice(0, 100) ?? [], null, 2)}

INVOICES:
${JSON.stringify(invoices ?? [], null, 2)}

Write a personalized financial briefing in 250-350 words. Include:

1. **Cash Flow Summary** — Net income/expenses for the period
2. **Outstanding Receivables** — Any overdue or upcoming invoices
3. **Spending Alerts** — Notable expenses or unusual patterns
4. **Action Items** — 2-3 specific things to do this week
5. **Outlook** — Brief forward-looking statement

Tone: Professional but warm, like a trusted advisor. Use specific dollar amounts. Address the recipient by first name. Do NOT use markdown headers — use plain text paragraphs with bold for emphasis.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const briefingContent = textBlock?.text ?? "";

    // Store briefing — user_id is now clerk userId directly
    const weekStartStr = weekStart.toISOString().split("T")[0];
    const { error: insertErr } = await supabase.from("briefings").insert({
      user_id: userId,
      content: briefingContent,
      week_start: weekStartStr,
    });

    if (insertErr) {
      console.error("[briefing] insert error:", insertErr);
      // Don't fail — briefing was generated successfully
    }

    return NextResponse.json({
      briefing: {
        content: briefingContent,
        week_start: weekStartStr,
        created_at: new Date().toISOString(),
      },
    });
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
