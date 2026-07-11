-- ============================================================
-- migration 003: public API keys + call log, backups metadata
-- ============================================================

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  name text,
  key text unique not null,
  scopes jsonb not null default '{"leads":{"read":true,"write":false},"tickets":{"read":true,"write":false}}',
  active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  last_used timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.api_logs (
  id bigserial primary key,
  api_key_id uuid,
  endpoint text,
  method text,
  status int,
  ok boolean,
  request jsonb,
  error text,
  remediation text,
  created_at timestamptz not null default now()
);
create index if not exists api_logs_time_idx on public.api_logs(created_at desc);

create table if not exists public.backups (
  id uuid primary key default gen_random_uuid(),
  path text,
  tables jsonb,
  row_counts jsonb,
  created_at timestamptz not null default now()
);

alter table public.api_keys enable row level security;
alter table public.api_logs enable row level security;
alter table public.backups  enable row level security;

-- managers manage keys; everyone authenticated can read logs/backups (viewers)
drop policy if exists api_keys_mgr on public.api_keys;
create policy api_keys_mgr on public.api_keys for all to authenticated using (public.is_manager()) with check (public.is_manager());
drop policy if exists api_logs_read on public.api_logs;
create policy api_logs_read on public.api_logs for select to authenticated using (public.is_manager());
drop policy if exists backups_read on public.backups;
create policy backups_read on public.backups for select to authenticated using (public.is_manager());
