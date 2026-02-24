import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { parseCSV, normalizeTransactions } from "@/lib/csv-parser";

export async function POST(req: NextRequest) {
  try {
    // 1. Auth — get Clerk userId
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse request body
    let body: { csvText?: string; currency?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { csvText, currency } = body;
    if (!csvText) {
      return NextResponse.json(
        { error: "Missing csvText in request body" },
        { status: 400 }
      );
    }

    // 3. Parse CSV
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

    // 4. Insert transactions directly — user_id = Clerk userId string
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const rows = normalized.map((t) => ({
      user_id: userId,
      date: t.date,
      description: t.description,
      amount: t.amount,
      currency: t.currency,
      type: t.type,
      category: t.category,
      source: "csv_upload",
    }));

    const { data: inserted, error: insertErr } = await supabase
      .from("transactions")
      .insert(rows)
      .select("id");

    if (insertErr) {
      console.error("[upload] Supabase insert error:", insertErr);
      return NextResponse.json(
        { error: "Failed to save transactions", detail: insertErr.message },
        { status: 500 }
      );
    }

    const count = inserted?.length ?? 0;
    return NextResponse.json({
      message: `Successfully imported ${count} transactions`,
      count,
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
