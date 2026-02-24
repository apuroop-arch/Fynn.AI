import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureUser } from "@/lib/supabase/ensure-user";
import { parseCSV, normalizeTransactions } from "@/lib/csv-parser";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { csvText, currency } = body as {
      csvText: string;
      currency?: string;
    };

    if (!csvText) {
      return NextResponse.json(
        { error: "Missing csvText in request body" },
        { status: 400 }
      );
    }

    // Parse and normalize
    const rawRows = await parseCSV(csvText);
    const normalized = normalizeTransactions(rawRows, currency);

    // Get or create the Supabase user
    const dbUser = await ensureUser(userId);

    // Insert transactions
    const supabase = createAdminClient();
    const transactionsToInsert = normalized.map((t) => ({
      user_id: dbUser.id,
      date: t.date,
      description: t.description,
      amount: t.amount,
      currency: t.currency,
      type: t.type,
      category: t.category,
      source: "csv_upload",
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("transactions")
      .insert(transactionsToInsert)
      .select();

    if (insertError) {
      console.error("Transaction insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to save transactions" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: `Successfully imported ${inserted.length} transactions`,
      count: inserted.length,
    });
  } catch (err) {
    console.error("[upload] Error:", err);
    const message = err instanceof Error ? err.message : "Upload failed";
    const status = message.includes("session expired") ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
