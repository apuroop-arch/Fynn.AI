import { currentUser } from "@clerk/nextjs/server";
import { createAdminClient } from "./admin";
import type { Database } from "./types";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

/**
 * Finds the Supabase user matching the current Clerk session.
 * If the user doesn't exist yet (e.g. webhook hasn't fired),
 * auto-creates the row using Clerk profile data.
 */
export async function ensureUser(clerkUserId: string): Promise<UserRow> {
  const supabase = createAdminClient();

  // ── diagnostic: verify table is reachable and inspect stored IDs ──
  const { data: allUsers, error: tableError } = await supabase
    .from("users")
    .select("id, clerk_user_id")
    .limit(10);

  console.log("[ensureUser] clerk auth() userId:", JSON.stringify(clerkUserId));
  console.log("[ensureUser] table query error:", tableError ?? "none");
  console.log(
    "[ensureUser] rows in users table:",
    allUsers
      ? allUsers.map((u) => ({
          id: u.id,
          clerk_user_id: u.clerk_user_id,
        }))
      : "null (table may not exist)"
  );
  // ── end diagnostic ──

  // Look up by clerk_user_id
  const { data: existing, error: lookupError } = await supabase
    .from("users")
    .select("*")
    .eq("clerk_user_id", clerkUserId)
    .single();

  console.log("[ensureUser] lookup result:", {
    found: !!existing,
    error: lookupError
      ? { code: lookupError.code, message: lookupError.message }
      : null,
  });

  if (existing) return existing;

  // User missing — pull profile from Clerk and create the row
  const clerkUser = await currentUser();

  if (!clerkUser) {
    throw new Error("Clerk session expired — cannot create user");
  }

  console.log("[ensureUser] Creating new user from Clerk profile:", {
    clerkId: clerkUser.id,
    email: clerkUser.emailAddresses[0]?.emailAddress,
  });

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
  const fullName =
    [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;

  const { data: created, error: insertError } = await supabase
    .from("users")
    .insert({
      clerk_user_id: clerkUserId,
      email,
      full_name: fullName,
      plan: "free",
      trial_start_date: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (insertError) {
    // If unique constraint violation, the row was created between our
    // SELECT and INSERT (race condition) — just fetch it again.
    if (insertError.code === "23505") {
      const { data: raced } = await supabase
        .from("users")
        .select("*")
        .eq("clerk_user_id", clerkUserId)
        .single();

      if (raced) return raced;
    }

    console.error("[ensureUser] Insert failed:", insertError);
    throw new Error(
      `Failed to create user in database: ${insertError.message}`
    );
  }

  if (!created) {
    throw new Error("Insert returned no data");
  }

  console.log("[ensureUser] Created user:", created.id);
  return created;
}
