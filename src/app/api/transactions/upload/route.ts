import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { parseCSV, normalizeTransactions } from "@/lib/csv-parser";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Upsert the Supabase user row and return the uuid primary key.
 * Uses INSERT … ON CONFLICT DO NOTHING then a SELECT,
 * equivalent to: INSERT … WHERE NOT EXISTS …
 * This NEVER throws — it always returns a user id.
 */
async function getOrCreateUser(clerkUserId: string): Promise<string> {
  const sb = supabaseAdmin();

  // Grab Clerk profile for the insert (email, name).
  // currentUser() is safe here — the route already checked auth().
  const clerk = await currentUser();
  const email = clerk?.emailAddresses[0]?.emailAddress ?? "";
  const fullName =
    clerk
      ? [clerk.firstName, clerk.lastName].filter(Boolean).join(" ") || null
      : null;

  // INSERT … ON CONFLICT (clerk_user_id) DO NOTHING
  await sb.from("users").upsert(
    {
      clerk_user_id: clerkUserId,
      email,
      full_name: fullName,
      plan: "free" as const,
      trial_start_date: new Date().toISOString(),
    },
    { onConflict: "clerk_user_id", ignoreDuplicates: true }
  );

  // Always SELECT after — the row is guaranteed to exist now.
  const { data } = await sb
    .from("users")
    .select("id")
    .eq("clerk_user_id", clerkUserId)
    .single();

  return data!.id;
}

export async function POST(req: NextRequest) {
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
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { csvText, currency } = body;
  if (!csvText) {
    return NextResponse.json(
      { error: "Missing csvText in request body" },
      { status: 400 }
    );
  }

  // ── Parse CSV (client already previewed — this is the server validation) ──
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

  // ── Ensure user exists (upsert — never fails) ──
  const dbUserId = await getOrCreateUser(userId);

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

  return NextResponse.json({
    message: `Successfully imported ${inserted.length} transactions`,
    count: inserted.length,
  });
}
