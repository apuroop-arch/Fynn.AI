import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureUser } from "@/lib/supabase/ensure-user";

const anthropic = new Anthropic();

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dbUser = await ensureUser(userId);
  const supabase = createAdminClient();

  // Get last 30 days of transactions
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", dbUser.id)
    .gte("date", thirtyDaysAgo)
    .order("date", { ascending: false });

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("user_id", dbUser.id);

  if (
    (!transactions || transactions.length === 0) &&
    (!invoices || invoices.length === 0)
  ) {
    return NextResponse.json({
      briefing: null,
      message: "No financial data available for briefing.",
    });
  }

  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + 1); // Monday

  const prompt = `You are a financial advisor writing a personalized weekly briefing for a freelancer/SMB owner.

RECIPIENT: ${dbUser.full_name || "Business Owner"}
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

  const stream = anthropic.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 2048,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: prompt }],
  });

  const response = await stream.finalMessage();

  const textBlock = response.content.find((block) => block.type === "text");
  const briefingContent = textBlock?.text ?? "";

  // Store briefing
  const { data: briefing } = await supabase
    .from("briefings")
    .insert({
      user_id: dbUser.id,
      content: briefingContent,
      week_start: weekStart.toISOString().split("T")[0],
    })
    .select()
    .single();

  return NextResponse.json({ briefing });
}
