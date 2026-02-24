import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

interface RecoveryEmail {
  sequence_number: number;
  subject_line: string;
  body: string;
  tone: "friendly" | "professional" | "firm";
  tone_assessment: string;
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { invoice_id?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { invoice_id } = body;
    if (!invoice_id) {
      return NextResponse.json(
        { error: "invoice_id is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Query invoice directly by clerk userId
    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoice_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (invError) {
      console.error("[recovery] invoice query error:", invError);
      return NextResponse.json(
        { error: "Failed to fetch invoice", detail: invError.message },
        { status: 500 }
      );
    }

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found. Make sure the invoice ID is correct and belongs to your account." },
        { status: 404 }
      );
    }

    // Get sender info from Clerk
    const clerkUser = await currentUser();
    const senderName = clerkUser
      ? [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || "Business Owner"
      : "Business Owner";
    const senderEmail = clerkUser?.emailAddresses[0]?.emailAddress ?? "";

    const daysOverdue = Math.floor(
      (Date.now() - new Date(invoice.due_date).getTime()) / (1000 * 60 * 60 * 24)
    );

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({ apiKey });

    const prompt = `You are a professional accounts receivable specialist writing recovery emails for a freelancer/SMB owner.

SENDER INFO:
- Name: ${senderName}
- Email: ${senderEmail}

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

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

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

    // Store emails — user_id is now clerk userId directly
    const emailsToInsert = emails.map((email) => ({
      user_id: userId,
      invoice_id: invoice.id,
      sequence_number: email.sequence_number,
      subject_line: email.subject_line,
      body: email.body,
      tone: email.tone,
    }));

    const { error: insertErr } = await supabase
      .from("recovery_emails")
      .insert(emailsToInsert);

    if (insertErr) {
      console.error("[recovery] insert error:", insertErr);
      // Don't fail the whole request — emails were generated successfully
    }

    return NextResponse.json({ emails, invoice });
  } catch (err) {
    console.error("[recovery] Unhandled error:", err);
    return NextResponse.json(
      {
        error: "Recovery email generation failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
