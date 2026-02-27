import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { parseCSV, normalizeTransactions } from "@/lib/csv-parser";

const BATCH_SIZE = 200; // Insert 200 rows at a time to avoid timeouts

export async function POST(req: NextRequest) {
  try {
    // 1. Auth — get Clerk userId
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse request body
    let body: { csvText?: string; currency?: string; transactions?: any[] };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    let rows: any[];

    // Support both modes: pre-parsed transactions array OR raw csvText
    if (body.transactions && Array.isArray(body.transactions)) {
      // Mode A: Pre-parsed transactions sent directly from frontend
      rows = body.transactions.map((t: any) => ({
        user_id: userId,
        date: t.date,
        description: t.description,
        amount: t.amount,
        currency: t.currency || body.currency || "USD",
        type: t.type,
        category: t.category || null,
        source: "csv_upload",
      }));
    } else if (body.csvText) {
      // Mode B: Legacy — raw CSV text (kept for backward compat)
      const { csvText, currency } = body;
      let normalized;
      try {
        const rawRows = await parseCSV(csvText);
        normalized = normalizeTransactions(rawRows, currency);
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "CSV parse error" },
          { status: 400 }
        );
      }

      if (normalized.length === 0) {
        return NextResponse.json(
          { error: "CSV file contains no valid transactions" },
          { status: 400 }
        );
      }

      rows = normalized.map((t) => ({
        user_id: userId,
        date: t.date,
        description: t.description,
        amount: t.amount,
        currency: t.currency,
        type: t.type,
        category: t.category,
        source: "csv_upload",
      }));
    } else {
      return NextResponse.json(
        { error: "Missing transactions or csvText in request body" },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No valid transactions to import" },
        { status: 400 }
      );
    }

    // 3. Insert in batches to avoid Supabase/Vercel limits
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let totalInserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      const { data: inserted, error: insertErr } = await supabase
        .from("transactions")
        .insert(batch)
        .select("id");

      if (insertErr) {
        console.error(`[upload] Batch ${batchNum} error:`, insertErr);
        errors.push(`Batch ${batchNum}: ${insertErr.message}`);
      } else {
        totalInserted += inserted?.length ?? 0;
      }
    }

    if (totalInserted === 0 && errors.length > 0) {
      return NextResponse.json(
        { error: "Failed to save transactions", detail: errors.join("; ") },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `Successfully imported ${totalInserted} transactions`,
      count: totalInserted,
      batches: Math.ceil(rows.length / BATCH_SIZE),
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error("[upload] Unhandled error:", err);
    return NextResponse.json(
      {
        error: "Internal server error",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
