import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// ============================================================
// ARCHITECTURE:
// 1. Excel → try LOCAL parse first (instant, free, handles 90%)
// 2. If local fails → AI parse with CHUNKING + SSE progress
// 3. PDF → AI parse (always, since PDFs need vision)
// 4. CSV with non-standard headers → AI parse with chunking
//
// SSE STREAMING: For large files needing AI, we stream progress
// updates so frontend shows a real progress bar.
// ============================================================

const DATE_KW = ["date", "txn date", "transaction date", "posting date", "value date", "book date"];
const DESC_KW = ["description", "narration", "particulars", "details", "memo", "remarks", "reference", "transaction details"];
const AMT_KW = ["amount", "transaction amount", "value", "sum", "total"];
const DR_KW = ["withdrawal", "debit", "debit amount", "dr", "withdrawal amt", "debit amt"];
const CR_KW = ["deposit", "credit", "credit amount", "cr", "deposit amt", "credit amt"];

interface LocalResult { success: boolean; csvText?: string; rowCount?: number; }

function tryLocalParse(rows: string[][]): LocalResult {
  try {
    let headerIdx = -1;
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const row = rows[i];
      if (!row || row.length < 2) continue;
      const cells = row.map(c => (c || "").toLowerCase().trim());
      const hasDate = cells.some(c => DATE_KW.some(k => c.includes(k)));
      const hasVal = cells.some(c => [...AMT_KW, ...DR_KW, ...CR_KW].some(k => c.includes(k)));
      if (hasDate && hasVal) { headerIdx = i; break; }
    }
    if (headerIdx === -1) return { success: false };

    const headers = rows[headerIdx].map(h => (h || "").toLowerCase().trim());
    const di = fc(headers, DATE_KW);
    const dsi = fc(headers, DESC_KW);
    const ai = fc(headers, AMT_KW);
    const dri = fc(headers, DR_KW);
    const cri = fc(headers, CR_KW);

    if (di === -1) return { success: false };
    const hasDC = dri !== -1 && cri !== -1;
    if (ai === -1 && !hasDC) return { success: false };

    const out = ["date,description,amount"];
    for (const row of rows.slice(headerIdx + 1)) {
      const dv = (row[di] || "").trim();
      if (!dv || !/\d/.test(dv)) continue;
      const desc = (dsi !== -1 ? row[dsi] || "" : "Transaction").trim();
      let amt: number;
      if (hasDC) {
        const dr = pn(row[dri] || "");
        const cr = pn(row[cri] || "");
        if (cr > 0) amt = cr; else if (dr > 0) amt = -dr; else continue;
      } else {
        amt = pn(row[ai] || "");
        if (amt === 0) continue;
      }
      const nd = normDate(dv);
      if (!nd) continue;
      const sd = desc.includes(",") ? `"${desc.replace(/"/g, '""')}"` : desc;
      out.push(`${nd},${sd},${amt.toFixed(2)}`);
    }
    if (out.length <= 1) return { success: false };
    return { success: true, csvText: out.join("\n"), rowCount: out.length - 1 };
  } catch { return { success: false }; }
}

function fc(h: string[], kw: string[]): number {
  for (const k of kw) { const i = h.findIndex(x => x.includes(k)); if (i !== -1) return i; } return -1;
}
function pn(r: string): number {
  const n = parseFloat(r.replace(/[₹$€£¥,\s]/g, "").trim()); return isNaN(n) ? 0 : n;
}
function normDate(raw: string): string | null {
  const t = raw.trim();
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) { let y = m[3]; if (y.length === 2) y = (parseInt(y) > 50 ? "19" : "20") + y; return `${y}-${m[1].padStart(2,"0")}-${m[2].padStart(2,"0")}`; }
  m = t.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
  if (m) { let y = m[3]; if (y.length === 2) y = (parseInt(y) > 50 ? "19" : "20") + y; return `${y}-${m[1].padStart(2,"0")}-${m[2].padStart(2,"0")}`; }
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(t)) { const [y,mo,d] = t.split("-"); return `${y}-${mo.padStart(2,"0")}-${d.padStart(2,"0")}`; }
  m = t.match(/^(\d{1,2})[\s-](\w{3,9})[\s-](\d{2,4})$/);
  if (m) { let y = m[3]; if (y.length === 2) y = (parseInt(y) > 50 ? "19" : "20") + y; const mo: Record<string,string> = {jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12"}; const mn = mo[m[2].toLowerCase().slice(0,3)]; if (mn) return `${y}-${mn}-${m[1].padStart(2,"0")}`; }
  m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (m) { let y = m[3]; if (y.length === 2) y = (parseInt(y) > 50 ? "19" : "20") + y; return `${y}-${m[1].padStart(2,"0")}-${m[2].padStart(2,"0")}`; }
  const p = new Date(t); return isNaN(p.getTime()) ? null : p.toISOString().split("T")[0];
}

const PROMPT = `Extract ALL transactions from this bank statement as CSV.
Headers: date,description,amount
- date: YYYY-MM-DD
- amount: positive=credit/deposit, negative=debit/withdrawal
- Combine separate debit/credit columns
- Skip balances, totals, headers, empty rows
- Quote descriptions containing commas
Return ONLY CSV. No markdown. No explanation.`;

function sseEvent(type: string, data: Record<string, unknown>): string {
  return `data: ${JSON.stringify({ type, ...data })}\n\n`;
}

// ============================================================
// CHUNKED AI PARSING WITH SSE PROGRESS
// ============================================================
async function parseChunkedWithAIStream(
  content: string, fileName: string, controller: ReadableStreamDefaultController
) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    controller.enqueue(new TextEncoder().encode(sseEvent("error", { message: "API key not configured" })));
    controller.close(); return;
  }
  const anthropic = new Anthropic({ apiKey });
  const lines = content.split("\n").filter(l => l.trim());
  const enc = new TextEncoder();

  // Small file — single request
  if (lines.length <= 300) {
    controller.enqueue(enc.encode(sseEvent("progress", { stage: "analyzing", message: "Analyzing transactions...", percent: 20 })));
    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514", max_tokens: 16384,
        messages: [{ role: "user", content: [
          { type: "text", text: `Bank statement: ${fileName}\n\n${content}` },
          { type: "text", text: PROMPT },
        ]}],
      });
      const text = response.content.find(b => b.type === "text")?.text?.trim() ?? "";
      let csv = text.replace(/^```(?:csv)?\s*/i, "").replace(/\s*```$/i, "").trim();
      if (!csv || !csv.includes(",")) { controller.enqueue(enc.encode(sseEvent("error", { message: "Could not extract transactions." }))); controller.close(); return; }
      const first = csv.split("\n")[0]?.toLowerCase().trim();
      if (!first?.includes("date") || !first?.includes("amount")) csv = "date,description,amount\n" + csv;
      const rowCount = csv.split("\n").filter(l => l.trim()).length - 1;
      controller.enqueue(enc.encode(sseEvent("complete", { csvText: csv, rowCount, message: `Extracted ${rowCount} transactions` })));
    } catch (err) {
      controller.enqueue(enc.encode(sseEvent("error", { message: err instanceof Error ? err.message : "AI parsing failed" })));
    }
    controller.close(); return;
  }

  // LARGE FILE — CHUNKING
  const headerContext = lines.slice(0, 15).join("\n");
  const dataLines = lines.slice(15);
  const CHUNK_SIZE = 200;
  const chunks: string[] = [];
  for (let i = 0; i < dataLines.length; i += CHUNK_SIZE) {
    chunks.push(headerContext + "\n" + dataLines.slice(i, i + CHUNK_SIZE).join("\n"));
  }

  const totalChunks = chunks.length;
  const totalBatches = Math.ceil(totalChunks / 3);
  controller.enqueue(enc.encode(sseEvent("progress", {
    stage: "chunking", message: `Splitting ${lines.length} rows into ${totalChunks} chunks (${totalBatches} batches)...`, percent: 5, totalChunks,
  })));

  const allCSVLines: string[] = ["date,description,amount"];
  let completedChunks = 0;

  for (let i = 0; i < chunks.length; i += 3) {
    const batch = chunks.slice(i, i + 3);
    const batchNum = Math.floor(i / 3) + 1;

    controller.enqueue(enc.encode(sseEvent("progress", {
      stage: "extracting",
      message: `Processing batch ${batchNum} of ${totalBatches}...`,
      percent: Math.round(10 + (completedChunks / totalChunks) * 80),
      completedChunks, totalChunks, transactionsFound: allCSVLines.length - 1,
    })));

    const results = await Promise.all(
      batch.map(async (chunk, idx) => {
        const chunkNum = i + idx + 1;
        try {
          const response = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514", max_tokens: 8192,
            messages: [{ role: "user", content: [
              { type: "text", text: `Bank statement: ${fileName} (chunk ${chunkNum}/${totalChunks})\n\n${chunk}` },
              { type: "text", text: PROMPT },
            ]}],
          });
          const text = response.content.find(b => b.type === "text")?.text?.trim() ?? "";
          return text.replace(/^```(?:csv)?\s*/i, "").replace(/\s*```$/i, "").trim();
        } catch (err) { console.error(`Chunk ${chunkNum} failed:`, err); return null; }
      })
    );

    for (const result of results) {
      completedChunks++;
      if (result) {
        for (const line of result.split("\n").filter(l => l.trim())) {
          if (!line.toLowerCase().startsWith("date,")) allCSVLines.push(line);
        }
      }
    }

    controller.enqueue(enc.encode(sseEvent("progress", {
      stage: "extracting",
      message: `Batch ${batchNum} done — ${allCSVLines.length - 1} transactions found`,
      percent: Math.round(10 + (completedChunks / totalChunks) * 80),
      completedChunks, totalChunks, transactionsFound: allCSVLines.length - 1,
    })));
  }

  if (allCSVLines.length <= 1) {
    controller.enqueue(enc.encode(sseEvent("error", { message: "Could not extract transactions." })));
    controller.close(); return;
  }

  const csvText = allCSVLines.join("\n");
  const rowCount = allCSVLines.length - 1;
  controller.enqueue(enc.encode(sseEvent("complete", { csvText, rowCount, message: `Extracted ${rowCount} transactions` })));
  controller.close();
}

// ============================================================
// AI DOCUMENT PARSING (PDF / binary Excel)
// ============================================================
async function parseDocumentWithAI(base64: string, mediaType: string): Promise<NextResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 16384,
    messages: [{ role: "user", content: [
      { type: "document", source: { type: "base64", media_type: mediaType as "application/pdf", data: base64 } } as Anthropic.DocumentBlockParam,
      { type: "text", text: PROMPT },
    ]}],
  });
  const text = response.content.find(b => b.type === "text")?.text?.trim() ?? "";
  let csv = text.replace(/^```(?:csv)?\s*/i, "").replace(/\s*```$/i, "").trim();
  if (!csv || !csv.includes(",")) return NextResponse.json({ error: "Could not extract transactions." }, { status: 400 });
  const first = csv.split("\n")[0]?.toLowerCase().trim();
  if (!first?.includes("date") || !first?.includes("amount")) csv = "date,description,amount\n" + csv;
  const rowCount = csv.split("\n").filter(l => l.trim()).length - 1;
  return NextResponse.json({ csvText: csv, rowCount, message: `Extracted ${rowCount} transactions` });
}

// ============================================================
// MAIN HANDLER
// ============================================================
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const rawText = formData.get("rawText") as string | null;
    const stream = formData.get("stream") === "true";

    if (!file && !rawText) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const fileName = file?.name.toLowerCase() ?? "";

    // ====== EXCEL ======
    if (file && (fileName.endsWith(".xlsx") || fileName.endsWith(".xls"))) {
      const arrayBuffer = await file.arrayBuffer();
      try {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(Buffer.from(arrayBuffer), { type: "buffer", cellDates: false, raw: false });
        const sn = wb.SheetNames[0];
        if (sn) {
          const sheet = wb.Sheets[sn];
          const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" }) as string[][];
          const local = tryLocalParse(rows);
          if (local.success && local.csvText) {
            return NextResponse.json({ csvText: local.csvText, rowCount: local.rowCount, message: `Extracted ${local.rowCount} transactions` });
          }
          // Local failed → AI + streaming
          const csvContent = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
          if (stream) {
            const readable = new ReadableStream({ start(controller) { parseChunkedWithAIStream(csvContent, file.name, controller); } });
            return new Response(readable, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
          }
          return await parseNonStream(csvContent, file.name);
        }
      } catch { /* xlsx not available */ }
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      return await parseDocumentWithAI(base64, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    }

    // ====== CSV ======
    if (file && fileName.endsWith(".csv")) {
      const text = await file.text();
      if (stream) {
        const readable = new ReadableStream({ start(controller) { parseChunkedWithAIStream(text, file.name, controller); } });
        return new Response(readable, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
      }
      return await parseNonStream(text, file.name);
    }

    // ====== PDF ======
    if (file && fileName.endsWith(".pdf")) {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      return await parseDocumentWithAI(base64, "application/pdf");
    }

    // ====== Raw text ======
    if (rawText) {
      if (stream) {
        const readable = new ReadableStream({ start(controller) { parseChunkedWithAIStream(rawText, "statement.csv", controller); } });
        return new Response(readable, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
      }
      return await parseNonStream(rawText, "statement.csv");
    }

    return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });
  } catch (err) {
    console.error("[parse-file] Error:", err);
    return NextResponse.json({ error: "Failed to parse file.", detail: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// NON-STREAMING FALLBACK
async function parseNonStream(content: string, fileName: string): Promise<NextResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  const anthropic = new Anthropic({ apiKey });
  const lines = content.split("\n").filter(l => l.trim());

  if (lines.length <= 300) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514", max_tokens: 16384,
      messages: [{ role: "user", content: [
        { type: "text", text: `Bank statement: ${fileName}\n\n${content}` },
        { type: "text", text: PROMPT },
      ]}],
    });
    const text = response.content.find(b => b.type === "text")?.text?.trim() ?? "";
    let csv = text.replace(/^```(?:csv)?\s*/i, "").replace(/\s*```$/i, "").trim();
    if (!csv || !csv.includes(",")) return NextResponse.json({ error: "Could not extract transactions." }, { status: 400 });
    const first = csv.split("\n")[0]?.toLowerCase().trim();
    if (!first?.includes("date") || !first?.includes("amount")) csv = "date,description,amount\n" + csv;
    const rowCount = csv.split("\n").filter(l => l.trim()).length - 1;
    return NextResponse.json({ csvText: csv, rowCount, message: `Extracted ${rowCount} transactions` });
  }

  const headerContext = lines.slice(0, 15).join("\n");
  const dataLines = lines.slice(15);
  const chunks: string[] = [];
  for (let i = 0; i < dataLines.length; i += 200) { chunks.push(headerContext + "\n" + dataLines.slice(i, i + 200).join("\n")); }

  const allCSVLines: string[] = ["date,description,amount"];
  for (let i = 0; i < chunks.length; i += 3) {
    const batch = chunks.slice(i, i + 3);
    const results = await Promise.all(batch.map(async (chunk, idx) => {
      try {
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514", max_tokens: 8192,
          messages: [{ role: "user", content: [
            { type: "text", text: `Bank statement: ${fileName} (chunk ${i+idx+1}/${chunks.length})\n\n${chunk}` },
            { type: "text", text: PROMPT },
          ]}],
        });
        const text = response.content.find(b => b.type === "text")?.text?.trim() ?? "";
        return text.replace(/^```(?:csv)?\s*/i, "").replace(/\s*```$/i, "").trim();
      } catch { return null; }
    }));
    for (const r of results) { if (r) { for (const l of r.split("\n").filter(l => l.trim())) { if (!l.toLowerCase().startsWith("date,")) allCSVLines.push(l); } } }
  }
  if (allCSVLines.length <= 1) return NextResponse.json({ error: "Could not extract transactions." }, { status: 400 });
  return NextResponse.json({ csvText: allCSVLines.join("\n"), rowCount: allCSVLines.length - 1, message: `Extracted ${allCSVLines.length - 1} transactions` });
}
