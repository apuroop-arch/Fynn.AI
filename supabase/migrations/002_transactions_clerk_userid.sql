-- Migration: Change transactions.user_id from uuid (FK to users) to text (Clerk userId)
-- Run this in the Supabase SQL Editor AFTER 001_initial.sql

-- 1. Drop the RLS policies that reference users table
drop policy if exists "Users can read own transactions" on public.transactions;
drop policy if exists "Users can insert own transactions" on public.transactions;
drop policy if exists "Users can delete own transactions" on public.transactions;

-- 2. Drop the foreign key constraint and index
alter table public.transactions drop constraint if exists transactions_user_id_fkey;
drop index if exists idx_transactions_user_id;

-- 3. Change the column type from uuid to text
alter table public.transactions alter column user_id type text using user_id::text;

-- 4. Create new simple RLS policies (user_id now stores Clerk userId directly)
-- Note: service_role key bypasses RLS, so these only apply to anon/authenticated clients
create policy "Users can read own transactions"
  on public.transactions for select
  using (user_id = auth.jwt() ->> 'sub');

create policy "Users can insert own transactions"
  on public.transactions for insert
  with check (user_id = auth.jwt() ->> 'sub');

create policy "Users can delete own transactions"
  on public.transactions for delete
  using (user_id = auth.jwt() ->> 'sub');

-- 5. Re-create the index
create index idx_transactions_user_id on public.transactions(user_id);
