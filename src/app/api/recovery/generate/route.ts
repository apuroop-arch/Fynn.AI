import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

const anthropic = new Anthropic();

interface RecoveryEmail {
  sequence_number: number;
  subject_line: string;
  body: string;
  tone: "friendly" | "professional" | "firm";
  tone_assessment: string;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { invoice_id } = (await req.json()) as { invoice_id: string };

  if (!invoice_id) {
    return NextResponse.json(
      { error: "invoice_id is required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Get user
  const { data: dbUser, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("clerk_user_id", userId)
    .single();

  if (userError || !dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Get invoice
  const { data: invoice, error: invError } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", invoice_id)
    .eq("user_id", dbUser.id)
    .single();

  if (invError || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const daysOverdue = Math.floor(
    (Date.now() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24)
  );

  const prompt = `You are a professional accounts receivable specialist writing recovery emails for a freelancer/SMB owner.

SENDER INFO:
- Name: ${dbUser.full_name || "Business Owner"}
- Email: ${dbUser.email}

INVOICE DETAILS:
- Client: ${invoice.client_name}
- Invoice Amount: $${invoice.amount}
- Currency: ${invoice.currency}
- Issued: ${invoice.issued_date}
- Due Date: ${invoice.due_date}
- Days Overdue: ${daysOverdue}
- Amount Paid: $${invoice.paid_amount}
- Outstanding Balance: $${invoice.amount - invoice.paid_amount}

Generate a 3-email recovery sequence with escalating tone:

1. Email 1 (Friendly Reminder) — Warm, assumes oversight. Sent at 30 days overdue.
2. Email 2 (Professional Follow-up) — Firmer, references prior email. Sent at 45 days overdue.
3. Email 3 (Final Notice) — Firm, mentions potential consequences. Sent at 60 days overdue.

For each email, provide:
- sequence_number (1, 2, or 3)
- subject_line
- body (professional HTML-ready text with paragraphs)
- tone ("friendly", "professional", or "firm")
- tone_assessment (brief explanation of the tone strategy)

Return ONLY a JSON array of 3 objects. No markdown wrapping.`;

  const stream = anthropic.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: prompt }],
  });

  const response = await stream.finalMessage();

  const textBlock = response.content.find((block) => block.type === "text");
  const rawText = textBlock?.text ?? "[]";

  let emails: RecoveryEmail[];
  try {
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawText.trim();
    emails = JSON.parse(jsonStr);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse AI response", raw: rawText },
      { status: 500 }
    );
  }

  // Store emails in database
  const emailsToInsert = emails.map((email) => ({
    user_id: dbUser.id,
    invoice_id: invoice.id,
    sequence_number: email.sequence_number,
    subject_line: email.subject_line,
    body: email.body,
    tone: email.tone,
  }));

  await supabase.from("recovery_emails").insert(emailsToInsert);

  return NextResponse.json({ emails, invoice });
}
