import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();
    const clerkProfile = await currentUser();

    if (!userId) {
      return NextResponse.json({
        step: "clerk_auth",
        error: "No active Clerk session — user is not signed in",
      });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      return NextResponse.json({
        step: "env_check",
        error: "Missing Supabase env vars",
        hasUrl: !!url,
        hasKey: !!key,
      });
    }

    // Check if service role key looks like the anon key (common misconfiguration)
    const keyMismatch = key === anonKey;

    const supabase = createClient(url, key);

    // Test: can we query the transactions table?
    const { data: txSample, error: txError } = await supabase
      .from("transactions")
      .select("id, user_id, date, description")
      .eq("user_id", userId)
      .limit(5);

    // Test: can we query the invoices table?
    const { data: invSample, error: invError } = await supabase
      .from("invoices")
      .select("id, user_id, client_name")
      .eq("user_id", userId)
      .limit(5);

    // Test: is ANTHROPIC_API_KEY set?
    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
    const anthropicKeyPrefix = process.env.ANTHROPIC_API_KEY?.slice(0, 10) ?? "not set";

    return NextResponse.json({
      clerk: {
        userId,
        email: clerkProfile?.emailAddresses[0]?.emailAddress ?? null,
        fullName: clerkProfile
          ? [clerkProfile.firstName, clerkProfile.lastName]
              .filter(Boolean)
              .join(" ")
          : null,
      },
      env: {
        supabaseUrl: url,
        serviceRoleKeyPrefix: key.slice(0, 15) + "...",
        anonKeyPrefix: anonKey?.slice(0, 15) + "...",
        keyMismatchWarning: keyMismatch
          ? "SERVICE_ROLE_KEY is the same as ANON_KEY — this is wrong! Get the real service_role key from Supabase Dashboard > Settings > API"
          : null,
        hasAnthropicKey,
        anthropicKeyPrefix: anthropicKeyPrefix + "...",
      },
      transactions: {
        error: txError
          ? { code: txError.code, message: txError.message, hint: txError.hint }
          : null,
        count: txSample?.length ?? 0,
        sample: txSample?.slice(0, 3) ?? [],
      },
      invoices: {
        error: invError
          ? { code: invError.code, message: invError.message, hint: invError.hint }
          : null,
        count: invSample?.length ?? 0,
      },
      diagnosis: keyMismatch
        ? "CRITICAL: SUPABASE_SERVICE_ROLE_KEY equals the anon key. Get the real service_role key from Supabase Dashboard > Settings > API."
        : txError
          ? `Transactions table error: ${txError.message}. Run the migration SQL in Supabase.`
          : (txSample?.length ?? 0) === 0
            ? "No transactions found for your user. Try uploading a CSV first."
            : `Found ${txSample?.length} transactions — everything looks good.`,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Debug endpoint crashed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
