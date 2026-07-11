-- ============================================================
-- בינה+ CRM — migration 002: sales side (opportunities, orders, payments)
-- + student/product field expansion. Apply: node scripts/run-sql.js migrations/002_sales.sql
-- ============================================================

-- ---- people: student + lead fields ----
alter table public.people
  add column if not exists product_id uuid references public.products(id) on delete set null,
  add column if not exists cycle_id uuid references public.cycles(id) on delete set null,
  add column if not exists entry_date date,
  add column if not exists received_access boolean,
  add column if not exists added_to_group boolean,
  add column if not exists manager_call boolean,
  add column if not exists agreement_status text,
  add column if not exists in_crm boolean;

-- ---- products: full sales fields ----
alter table public.products
  add column if not exists price_before_vat numeric,
  add column if not exists price_after_vat numeric,
  add column if not exists info text,
  add column if not exists cardcom_params jsonb;

-- ---- opportunities ----
create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.people(id) on delete cascade,
  training_type text,
  status text default 'new',
  owner uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists opp_person_idx on public.opportunities(person_id);

-- ---- opportunity notes (feed: text + file) ----
create table if not exists public.opportunity_notes (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  author uuid references public.users(id) on delete set null,
  body text,
  file_url text,
  created_at timestamptz not null default now()
);
create index if not exists opp_notes_idx on public.opportunity_notes(opportunity_id, created_at);

-- ---- orders ----
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.people(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  cycle_id uuid references public.cycles(id) on delete set null,
  owner uuid references public.users(id) on delete set null,
  close_date date,
  deal_amount numeric,
  deposit numeric,
  remaining numeric,
  status text default 'awaiting' check (status in ('paid_full','deposit','awaiting','cancelled')),
  agreement_status text,
  collection_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_person_idx on public.orders(person_id);

-- ---- payments ----
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  person_id uuid references public.people(id) on delete set null,
  amount_incl_vat numeric,
  amount_excl_vat numeric,
  payment_type text,
  num_payments int default 1,
  per_payment numeric,
  financing_pct numeric,
  after_financing_incl numeric,
  after_financing_excl numeric,
  owner uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists payments_order_idx on public.payments(order_id);

-- ============================================================
-- RLS
-- ============================================================
alter table public.opportunities      enable row level security;
alter table public.opportunity_notes  enable row level security;
alter table public.orders             enable row level security;
alter table public.payments           enable row level security;

do $$ declare t text; begin
  foreach t in array array['opportunities','orders','payments'] loop
    execute format('drop policy if exists %I_read on public.%I;', t, t);
    execute format('create policy %I_read on public.%I for select to authenticated using (true);', t, t);
    execute format('drop policy if exists %I_write on public.%I;', t, t);
    execute format('create policy %I_write on public.%I for all to authenticated using (true) with check (true);', t, t);
  end loop;
end $$;

-- opportunity_notes: everyone reads; author (or manager) edits/deletes own
drop policy if exists opp_notes_read on public.opportunity_notes;
create policy opp_notes_read on public.opportunity_notes for select to authenticated using (true);
drop policy if exists opp_notes_insert on public.opportunity_notes;
create policy opp_notes_insert on public.opportunity_notes for insert to authenticated with check (true);
drop policy if exists opp_notes_update on public.opportunity_notes;
create policy opp_notes_update on public.opportunity_notes for update to authenticated
  using (author = public.current_rep_id() or public.is_manager());
drop policy if exists opp_notes_delete on public.opportunity_notes;
create policy opp_notes_delete on public.opportunity_notes for delete to authenticated
  using (author = public.current_rep_id() or public.is_manager());
