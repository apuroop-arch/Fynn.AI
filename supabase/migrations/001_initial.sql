-- Fynn.AI Initial Schema
-- Run this in the Supabase SQL Editor

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Custom enum types
create type plan_type as enum ('free', 'pro', 'enterprise');
create type transaction_type as enum ('credit', 'debit');
create type invoice_status as enum ('paid', 'unpaid', 'overdue', 'partial');
create type email_tone as enum ('friendly', 'professional', 'firm');

-- ============================================================
-- USERS TABLE
-- ============================================================
create table public.users (
  id uuid default uuid_generate_v4() primary key,
  clerk_user_id text unique not null,
  email text unique not null,
  full_name text,
  plan plan_type default 'free' not null,
  trial_start_date timestamptz,
  created_at timestamptz default now() not null
);

alter table public.users enable row level security;

create policy "Users can read own row"
  on public.users for select
  using (clerk_user_id = auth.jwt() ->> 'sub');

create policy "Users can update own row"
  on public.users for update
  using (clerk_user_id = auth.jwt() ->> 'sub');

-- ============================================================
-- TRANSACTIONS TABLE
-- ============================================================
create table public.transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  date date not null,
  description text not null,
  amount numeric(12,2) not null,
  currency text default 'USD' not null,
  category text,
  type transaction_type not null,
  source text,
  created_at timestamptz default now() not null
);

alter table public.transactions enable row level security;

create policy "Users can read own transactions"
  on public.transactions for select
  using (user_id in (
    select id from public.users where clerk_user_id = auth.jwt() ->> 'sub'
  ));

create policy "Users can insert own transactions"
  on public.transactions for insert
  with check (user_id in (
    select id from public.users where clerk_user_id = auth.jwt() ->> 'sub'
  ));

create policy "Users can delete own transactions"
  on public.transactions for delete
  using (user_id in (
    select id from public.users where clerk_user_id = auth.jwt() ->> 'sub'
  ));

-- ============================================================
-- INVOICES TABLE
-- ============================================================
create table public.invoices (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  client_name text not null,
  amount numeric(12,2) not null,
  currency text default 'USD' not null,
  issued_date date not null,
  due_date date not null,
  status invoice_status default 'unpaid' not null,
  paid_amount numeric(12,2) default 0 not null,
  created_at timestamptz default now() not null
);

alter table public.invoices enable row level security;

create policy "Users can read own invoices"
  on public.invoices for select
  using (user_id in (
    select id from public.users where clerk_user_id = auth.jwt() ->> 'sub'
  ));

create policy "Users can insert own invoices"
  on public.invoices for insert
  with check (user_id in (
    select id from public.users where clerk_user_id = auth.jwt() ->> 'sub'
  ));

create policy "Users can update own invoices"
  on public.invoices for update
  using (user_id in (
    select id from public.users where clerk_user_id = auth.jwt() ->> 'sub'
  ));

-- ============================================================
-- RECOVERY EMAILS TABLE
-- ============================================================
create table public.recovery_emails (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  invoice_id uuid references public.invoices(id) on delete cascade not null,
  sequence_number integer not null check (sequence_number between 1 and 3),
  subject_line text not null,
  body text not null,
  tone email_tone not null,
  sent boolean default false not null,
  sent_at timestamptz,
  created_at timestamptz default now() not null
);

alter table public.recovery_emails enable row level security;

create policy "Users can read own recovery emails"
  on public.recovery_emails for select
  using (user_id in (
    select id from public.users where clerk_user_id = auth.jwt() ->> 'sub'
  ));

create policy "Users can insert own recovery emails"
  on public.recovery_emails for insert
  with check (user_id in (
    select id from public.users where clerk_user_id = auth.jwt() ->> 'sub'
  ));

create policy "Users can update own recovery emails"
  on public.recovery_emails for update
  using (user_id in (
    select id from public.users where clerk_user_id = auth.jwt() ->> 'sub'
  ));

-- ============================================================
-- BRIEFINGS TABLE
-- ============================================================
create table public.briefings (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  content text not null,
  week_start date not null,
  emailed boolean default false not null,
  created_at timestamptz default now() not null
);

alter table public.briefings enable row level security;

create policy "Users can read own briefings"
  on public.briefings for select
  using (user_id in (
    select id from public.users where clerk_user_id = auth.jwt() ->> 'sub'
  ));

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_users_clerk_id on public.users(clerk_user_id);
create index idx_transactions_user_id on public.transactions(user_id);
create index idx_transactions_date on public.transactions(date);
create index idx_invoices_user_id on public.invoices(user_id);
create index idx_invoices_status on public.invoices(status);
create index idx_invoices_due_date on public.invoices(due_date);
create index idx_recovery_emails_invoice_id on public.recovery_emails(invoice_id);
create index idx_briefings_user_id on public.briefings(user_id);
create index idx_briefings_week_start on public.briefings(week_start);
