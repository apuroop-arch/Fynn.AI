-- Migration: Change ALL tables to use Clerk userId (text) instead of users.id (uuid)
-- Run this in the Supabase SQL Editor AFTER 001 and 002

-- ============================================================
-- INVOICES TABLE
-- ============================================================
drop policy if exists "Users can read own invoices" on public.invoices;
drop policy if exists "Users can insert own invoices" on public.invoices;
drop policy if exists "Users can update own invoices" on public.invoices;

alter table public.invoices drop constraint if exists invoices_user_id_fkey;
drop index if exists idx_invoices_user_id;
alter table public.invoices alter column user_id type text using user_id::text;
create index idx_invoices_user_id on public.invoices(user_id);

create policy "Users can read own invoices"
  on public.invoices for select using (user_id = auth.jwt() ->> 'sub');
create policy "Users can insert own invoices"
  on public.invoices for insert with check (user_id = auth.jwt() ->> 'sub');
create policy "Users can update own invoices"
  on public.invoices for update using (user_id = auth.jwt() ->> 'sub');

-- ============================================================
-- RECOVERY EMAILS TABLE
-- ============================================================
drop policy if exists "Users can read own recovery emails" on public.recovery_emails;
drop policy if exists "Users can insert own recovery emails" on public.recovery_emails;
drop policy if exists "Users can update own recovery emails" on public.recovery_emails;

alter table public.recovery_emails drop constraint if exists recovery_emails_user_id_fkey;
alter table public.recovery_emails alter column user_id type text using user_id::text;

create policy "Users can read own recovery emails"
  on public.recovery_emails for select using (user_id = auth.jwt() ->> 'sub');
create policy "Users can insert own recovery emails"
  on public.recovery_emails for insert with check (user_id = auth.jwt() ->> 'sub');
create policy "Users can update own recovery emails"
  on public.recovery_emails for update using (user_id = auth.jwt() ->> 'sub');

-- ============================================================
-- BRIEFINGS TABLE
-- ============================================================
drop policy if exists "Users can read own briefings" on public.briefings;

alter table public.briefings drop constraint if exists briefings_user_id_fkey;
drop index if exists idx_briefings_user_id;
alter table public.briefings alter column user_id type text using user_id::text;
create index idx_briefings_user_id on public.briefings(user_id);

create policy "Users can read own briefings"
  on public.briefings for select using (user_id = auth.jwt() ->> 'sub');
