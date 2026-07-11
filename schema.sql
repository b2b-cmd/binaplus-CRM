-- ============================================================
-- בינה+ CRM — v1 schema (Service module)
-- Postgres / Supabase. Apply via scripts/run-sql.js (Management API).
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- users (נציגים) ----------
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique references auth.users(id) on delete set null,
  full_name text not null,
  phone text,
  email text unique not null,
  permission_level text not null default 'user'
    check (permission_level in ('user','team_manager','system_admin')),
  user_type text not null default 'service'
    check (user_type in ('sales','service','general_manager')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- people (ליד+תלמיד+פונה מאוחד) ----------
create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  email text,
  source text,
  sales_status text default 'new_lead',
  assigned_sales_rep uuid references public.users(id) on delete set null,
  cloudchat_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists people_phone_idx on public.people (phone);
create index if not exists people_email_idx on public.people (lower(email));

-- ---------- products / modules / cycles ----------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text,
  syllabus_url text,
  payment_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  number int,
  name text not null
);
create table if not exists public.cycles (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  lecturer_name text, lecturer_phone text, lecturer_email text,
  start_date date, end_date date,
  seats_total int,
  portal_url text,
  created_at timestamptz not null default now()
);

-- ---------- tickets (פניות שירות) ----------
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references public.people(id) on delete set null,
  type text,
  module_id uuid references public.modules(id) on delete set null,
  cycle_id uuid references public.cycles(id) on delete set null,
  summary text,
  description text,
  channel text default 'manual'
    check (channel in ('whatsapp','email','form','phone','manual')),
  status text not null default 'new'
    check (status in ('new','in_progress','waiting','closed')),
  urgency text default 'med' check (urgency in ('low','med','high')),
  assigned_rep uuid references public.users(id) on delete set null,
  handled_by text check (handled_by in ('human','ai')),
  first_response_at timestamptz,
  resolved_at timestamptz,
  sla_due timestamptz,
  csat_score int,
  reopen_count int not null default 0,
  tags text[] default '{}',
  source_ref text,      -- email message-id / cloudchat convo id
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tickets_status_idx on public.tickets (status);
create index if not exists tickets_person_idx on public.tickets (person_id);
create index if not exists tickets_assigned_idx on public.tickets (assigned_rep);

-- ---------- ticket_messages (thread) ----------
create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  direction text not null check (direction in ('in','out')),
  channel text,
  body text,
  sender text,
  ai_generated boolean not null default false,
  attachments jsonb default '[]',
  created_at timestamptz not null default now()
);
create index if not exists ticket_messages_ticket_idx on public.ticket_messages (ticket_id, created_at);

-- ---------- knowledge_base ----------
create table if not exists public.knowledge_base (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references public.modules(id) on delete set null,
  topic text,
  question text,
  answer text,
  tags text[] default '{}',
  created_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ---------- saved_views ----------
create table if not exists public.saved_views (
  id uuid primary key default gen_random_uuid(),
  screen text not null,
  name text not null,
  filters jsonb default '{}',
  columns jsonb default '[]',
  owner uuid references public.users(id) on delete cascade,
  shared boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- audit_log ----------
create table if not exists public.audit_log (
  id bigserial primary key,
  tbl text not null,
  record_id uuid,
  field text,
  old_value text,
  new_value text,
  changed_by uuid references public.users(id) on delete set null,
  changed_at timestamptz not null default now()
);

-- ============================================================
-- Helper functions (RLS)
-- ============================================================
create or replace function public.current_rep_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.users where auth_id = auth.uid() limit 1;
$$;

create or replace function public.is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users
    where auth_id = auth.uid() and permission_level in ('team_manager','system_admin') and active
  );
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table public.users            enable row level security;
alter table public.people           enable row level security;
alter table public.products         enable row level security;
alter table public.modules          enable row level security;
alter table public.cycles           enable row level security;
alter table public.tickets          enable row level security;
alter table public.ticket_messages  enable row level security;
alter table public.knowledge_base   enable row level security;
alter table public.saved_views      enable row level security;
alter table public.audit_log        enable row level security;

-- users: everyone authenticated can read the roster; only managers write.
drop policy if exists users_read on public.users;
create policy users_read on public.users for select to authenticated using (true);
drop policy if exists users_write on public.users;
create policy users_write on public.users for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- shared reference tables: authenticated read; manager write.
do $$
declare t text;
begin
  foreach t in array array['products','modules','cycles','knowledge_base'] loop
    execute format('drop policy if exists %I_read on public.%I;', t, t);
    execute format('create policy %I_read on public.%I for select to authenticated using (true);', t, t);
    execute format('drop policy if exists %I_write on public.%I;', t, t);
    execute format('create policy %I_write on public.%I for all to authenticated using (public.is_manager()) with check (public.is_manager());', t, t);
  end loop;
end $$;

-- people: managers see all; users see their assigned. All authenticated can create/update (service reps handle anyone's ticket subject).
drop policy if exists people_read on public.people;
create policy people_read on public.people for select to authenticated
  using (public.is_manager() or assigned_sales_rep = public.current_rep_id() or assigned_sales_rep is null);
drop policy if exists people_write on public.people;
create policy people_write on public.people for all to authenticated using (true) with check (true);

-- tickets: managers all; users see assigned or unassigned. All authenticated can write (service work).
drop policy if exists tickets_read on public.tickets;
create policy tickets_read on public.tickets for select to authenticated
  using (public.is_manager() or assigned_rep = public.current_rep_id() or assigned_rep is null);
drop policy if exists tickets_write on public.tickets;
create policy tickets_write on public.tickets for all to authenticated using (true) with check (true);

-- ticket_messages: follow ticket visibility (simplified: any authenticated).
drop policy if exists tmsg_all on public.ticket_messages;
create policy tmsg_all on public.ticket_messages for all to authenticated using (true) with check (true);

-- saved_views: owner or shared.
drop policy if exists views_read on public.saved_views;
create policy views_read on public.saved_views for select to authenticated
  using (shared or owner = public.current_rep_id() or public.is_manager());
drop policy if exists views_write on public.saved_views;
create policy views_write on public.saved_views for all to authenticated
  using (owner = public.current_rep_id() or public.is_manager())
  with check (owner = public.current_rep_id() or public.is_manager());

-- audit_log: managers read; anyone authenticated insert.
drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select to authenticated using (public.is_manager());
drop policy if exists audit_insert on public.audit_log;
create policy audit_insert on public.audit_log for insert to authenticated with check (true);
