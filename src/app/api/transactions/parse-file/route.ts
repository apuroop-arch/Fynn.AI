import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const EXTRACTION_PROMPT = `You are a universal bank statement parser. Your job is to extract transactions from ANY bank statement format from ANY bank in ANY country worldwide.

The input may be:
- A bank statement PDF (as a document)
- Raw text/CSV content from an Excel or CSV bank statement
- Data with non-standard column names, merged cells, title rows, or unusual formatting

RULES FOR EXTRACTION:
1. Find ALL individual transactions in the data
2. For each transaction, extract: date, description, amount
3. Date format: ALWAYS output as YYYY-MM-DD regardless of input format
4. Description: The transaction narration/description/particulars/memo — whatever the bank calls it
5. Amount: POSITIVE for money coming IN (credits, deposits, incoming transfers). NEGATIVE for money going OUT (debits, withdrawals, payments, charges)
6. If the bank uses separate columns for Debit and Credit (common in Indian, Asian, Middle Eastern banks), combine them: credit values become positive, debit values become negative
7. SKIP these rows: opening balance, closing balance, totals, subtotals, headers, bank name, account details, page numbers, empty rows
8. Handle ALL date formats: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD-Mon-YYYY (e.g., 15-Jan-2025), DD.MM.YYYY, and any other format
9. Handle ALL number formats: 1,234.56 (US/UK), 1.234,56 (Europe), 1,23,456.78 (Indian numbering), plain numbers
10. If there is a "Balance" column, IGNORE it — do not use balance values as transaction amounts

OUTPUT FORMAT:
Return ONLY valid CSV text with these exact headers on the first line:
date,description,amount

Example output:
date,description,amount
2025-01-15,Salary Credit from ABC Corp,5000.00
2025-01-16,Amazon Purchase,-49.99
2025-01-17,ATM Withdrawal,-200.00

CRITICAL:
- Return ONLY the CSV. No markdown fences. No backticks. No explanation. No preamble.
- Every row must have exactly 3 comma-separated values
- If a description contains a comma, wrap it in double quotes: "Payment to Smith, John"
- Include ALL transactions. Do not summarize or skip any.
- If you cannot find any transactions, return just the header line: date,description,amount`;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const rawText = formData.get("rawText") as string | null;

    if (!file && !rawText) {
      return NextResponse.json(
        { error: "No file or data provided" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const anthropic = new Anthropic({ apiKey });

    // Build the message content based on file type
    const messageContent: Anthropic.MessageCreateParams["messages"][0]["content"] = [];

    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith(".pdf")) {
        messageContent.push({
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: base64,
          },
        });
      } else if (
        fileName.endsWith(".xlsx") ||
        fileName.endsWith(".xls")
      ) {
        // Try to convert Excel to text using xlsx library
        // If xlsx is not available, send raw content description to AI
        try {
          const XLSX = await import("xlsx");
          const workbook = XLSX.read(Buffer.from(arrayBuffer), {
            type: "buffer",
            cellDates: true,
            raw: false,
          });

          // Combine all sheets
          const allText: string[] = [];
          for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
            if (csv.trim()) {
              allText.push(`--- Sheet: ${sheetName} ---\n${csv}`);
            }
          }

          const excelText = allText.join("\n\n");
          messageContent.push({
            type: "text",
            text: `Here is the raw content from an Excel bank statement file (${file.name}):\n\n${excelText}`,
          });
        } catch {
          // xlsx library not available — send as base64 document
          // Claude can read Excel files directly as documents
          messageContent.push({
            type: "document",
            source: {
              type: "base64",
              media_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" as "application/pdf",
              data: base64,
            },
          } as Anthropic.DocumentBlockParam);
        }
      } else if (fileName.endsWith(".csv")) {
        const text = await file.text();
        messageContent.push({
          type: "text",
          text: `Here is the raw content from a CSV bank statement file (${file.name}):\n\n${text}`,
        });
      } else {
        return NextResponse.json(
          { error: "Unsupported file type. Please upload CSV, Excel, or PDF." },
          { status: 400 }
        );
      }
    } else if (rawText) {
      // Raw text from CSV/Excel that couldn't be parsed client-side
      messageContent.push({
        type: "text",
        text: `Here is the raw content from a bank statement:\n\n${rawText}`,
      });
    }

    messageContent.push({
      type: "text",
      text: EXTRACTION_PROMPT,
    });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      messages: [{ role: "user", content: messageContent }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    let csvText = textBlock?.text?.trim() ?? "";

    // Clean up markdown fences if present
    csvText = csvText
      .replace(/^```(?:csv)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    if (!csvText || !csvText.includes(",")) {
      return NextResponse.json(
        {
          error:
            "Could not extract transactions from this file. Please ensure it contains bank transaction data.",
        },
        { status: 400 }
      );
    }

    // Validate the CSV has the expected header
    const firstLine = csvText.split("\n")[0]?.toLowerCase().trim();
    if (!firstLine?.includes("date") || !firstLine?.includes("amount")) {
      // AI didn't follow format — prepend header
      csvText = "date,description,amount\n" + csvText;
    }

    // Count extracted rows
    const rowCount = csvText.split("\n").filter((l) => l.trim()).length - 1;

    return NextResponse.json({
      csvText,
      rowCount,
      message: `Extracted ${rowCount} transactions`,
    });
  } catch (err) {
    console.error("[parse-file] Error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: "Failed to parse file. " + (
          message.includes("Could not process") 
            ? "The file format may not be supported." 
            : "Please try again or use a different file format."
        ),
        detail: message,
      },
      { status: 500 }
    );
  }
}
