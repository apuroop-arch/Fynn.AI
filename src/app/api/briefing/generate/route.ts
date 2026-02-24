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
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const { data: transactions } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .gte("date", thirtyDaysAgo)
      .order("date", { ascending: false });

    // Invoices still use users table FK — look up user first
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let invoices: any[] = [];
    let userName = "Business Owner";

    const { data: userRow } = await supabase
      .from("users")
      .select("id, full_name")
      .eq("clerk_user_id", userId)
      .maybeSingle();

    if (userRow) {
      userName = userRow.full_name || userName;
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
        briefing: null,
        message: "No financial data available for briefing.",
      });
    }

    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1);

    const prompt = `You are a financial advisor writing a personalized weekly briefing for a freelancer/SMB owner.

RECIPIENT: ${userName}
WEEK OF: ${weekStart.toISOString().split("T")[0]}

RECENT TRANSACTIONS (last 30 days):
${JSON.stringify(transactions?.slice(0, 100) ?? [], null, 2)}

INVOICES:
${JSON.stringify(invoices, null, 2)}

Write a personalized financial briefing in 250-350 words. Include:

1. **Cash Flow Summary** — Net income/expenses for the period
2. **Outstanding Receivables** — Any overdue or upcoming invoices
3. **Spending Alerts** — Notable expenses or unusual patterns
4. **Action Items** — 2-3 specific things to do this week
5. **Outlook** — Brief forward-looking statement

Tone: Professional but warm, like a trusted advisor. Use specific dollar amounts. Address the recipient by first name. Do NOT use markdown headers — use plain text paragraphs with bold for emphasis.`;

    const stream = anthropic.messages.stream({
      model: "claude-opus-4-6",
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: prompt }],
    });

    const response = await stream.finalMessage();

    const textBlock = response.content.find((block) => block.type === "text");
    const briefingContent = textBlock?.text ?? "";

    // Store briefing — if user exists in users table, store with their uuid
    if (userRow) {
      await supabase
        .from("briefings")
        .insert({
          user_id: userRow.id,
          content: briefingContent,
          week_start: weekStart.toISOString().split("T")[0],
        });
    }

    return NextResponse.json({
      briefing: { content: briefingContent },
    });
  } catch (err) {
    console.error("[briefing] Unhandled error:", err);
    return NextResponse.json(
      {
        error: "Internal server error",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
