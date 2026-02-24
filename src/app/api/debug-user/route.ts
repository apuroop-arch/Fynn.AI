import { auth, currentUser } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET() {
  // 1. Clerk session
  const { userId } = await auth();
  const clerkProfile = await currentUser();

  if (!userId) {
    return NextResponse.json({
      step: "clerk_auth",
      error: "No active Clerk session — user is not signed in",
    });
  }

  // 2. Supabase admin client (inline, no shared module)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return NextResponse.json({
      step: "env_check",
      error: "Missing Supabase env vars",
      hasUrl: !!url,
      hasKey: !!key,
    });
  }

  const supabase = createClient(url, key);

  // 3. Try to list all users (proves table + service role work)
  const { data: allUsers, error: tableErr } = await supabase
    .from("users")
    .select("id, clerk_user_id, email")
    .limit(10);

  // 4. Look up this specific user
  const { data: match, error: lookupErr } = await supabase
    .from("users")
    .select("id, clerk_user_id, email, plan")
    .eq("clerk_user_id", userId)
    .maybeSingle();

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
    supabase: {
      tableError: tableErr
        ? { code: tableErr.code, message: tableErr.message, hint: tableErr.hint }
        : null,
      totalRows: allUsers?.length ?? 0,
      allClerkIds: allUsers?.map((u) => u.clerk_user_id) ?? [],
      matchFound: !!match,
      matchRow: match,
      lookupError: lookupErr
        ? { code: lookupErr.code, message: lookupErr.message, hint: lookupErr.hint }
        : null,
    },
    diagnosis:
      tableErr
        ? "Cannot reach users table — run the migration SQL in Supabase"
        : !allUsers || allUsers.length === 0
          ? "Users table is empty — no users have been created yet"
          : match
            ? "User found — upload should work"
            : `Clerk userId "${userId}" does not match any clerk_user_id in the table. Stored IDs: ${allUsers?.map((u) => u.clerk_user_id).join(", ")}`,
  });
}
