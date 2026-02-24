import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { parseCSV, normalizeTransactions } from "@/lib/csv-parser";

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase environment variables");
  }
  return createClient(url, key);
}

/**
 * Upsert the Supabase user row and return the uuid primary key.
 */
async function getOrCreateUser(clerkUserId: string): Promise<string> {
  const sb = supabaseAdmin();

  const clerk = await currentUser();
  const email = clerk?.emailAddresses[0]?.emailAddress ?? "";
  const fullName =
    clerk
      ? [clerk.firstName, clerk.lastName].filter(Boolean).join(" ") || null
      : null;

  // INSERT … ON CONFLICT (clerk_user_id) DO NOTHING
  const { error: upsertErr } = await sb.from("users").upsert(
    {
      clerk_user_id: clerkUserId,
      email,
      full_name: fullName,
      plan: "free" as const,
      trial_start_date: new Date().toISOString(),
    },
    { onConflict: "clerk_user_id", ignoreDuplicates: true }
  );

  if (upsertErr) {
    throw new Error(`User upsert failed: ${upsertErr.message}`);
  }

  // SELECT — the row is guaranteed to exist now.
  const { data, error: selectErr } = await sb
    .from("users")
    .select("id")
    .eq("clerk_user_id", clerkUserId)
    .single();

  if (selectErr || !data) {
    throw new Error(
      `User lookup failed after upsert: ${selectErr?.message ?? "no data returned"}`
    );
  }

  return data.id;
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth ──
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Parse body ──
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

    // ── Parse CSV ──
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

    // ── Ensure user exists ──
    let dbUserId: string;
    try {
      dbUserId = await getOrCreateUser(userId);
    } catch (err) {
      return NextResponse.json(
        {
          error: "Failed to resolve user account",
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 500 }
      );
    }

    // ── Insert transactions ──
    const sb = supabaseAdmin();
    const rows = normalized.map((t) => ({
      user_id: dbUserId,
      date: t.date,
      description: t.description,
      amount: t.amount,
      currency: t.currency,
      type: t.type,
      category: t.category,
      source: "csv_upload",
    }));

    const { data: inserted, error: insertErr } = await sb
      .from("transactions")
      .insert(rows)
      .select();

    if (insertErr) {
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
    // Top-level catch — guarantees a JSON response no matter what
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
