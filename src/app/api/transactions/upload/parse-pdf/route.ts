import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Please upload a PDF file" },
        { status: 400 }
      );
    }

    // Convert PDF to base64
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // Use Claude to extract transactions from the PDF
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            {
              type: "text",
              text: `Extract all transactions from this bank statement PDF and return them as CSV text.

The CSV must have these exact headers: date,description,amount

Rules:
- date: Use YYYY-MM-DD format
- description: The transaction description/narration/particulars
- amount: Positive for credits/deposits, negative for debits/withdrawals. Use plain numbers, no currency symbols.
- Include ALL transactions found in the document
- Do NOT include opening/closing balances as transactions
- Do NOT include headers, summary rows, or totals
- If there are separate debit and credit columns, combine them: credits are positive, debits are negative

Return ONLY the CSV text. No markdown fences. No explanation. Just the CSV with headers on the first line.`,
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    const csvText = textBlock?.text?.trim() ?? "";

    if (!csvText || !csvText.includes(",")) {
      return NextResponse.json(
        {
          error:
            "Could not extract transactions from this PDF. Please ensure it is a bank statement with transaction data.",
        },
        { status: 400 }
      );
    }

    // Clean up: remove any markdown fences if present
    const cleanCSV = csvText
      .replace(/^```(?:csv)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    return NextResponse.json({ csvText: cleanCSV });
  } catch (err) {
    console.error("[parse-pdf] Error:", err);
    return NextResponse.json(
      {
        error: "Failed to parse PDF",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
