-- ============================================================
-- 011: rich email — message headers/html/arrival-time + scheduled outbox
-- ============================================================

alter table public.ticket_messages
  add column if not exists email_subject text,
  add column if not exists email_to text,
  add column if not exists email_cc text,
  add column if not exists body_html text,
  add column if not exists received_at timestamptz,
  add column if not exists scheduled boolean not null default false;

-- scheduled / immediate outgoing emails
create table if not exists public.outbox (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references public.tickets(id) on delete cascade,
  to_email text not null,
  subject text,
  body text,
  body_html text,
  thread_ref text,
  attachments jsonb not null default '[]',
  send_at timestamptz not null default now(),
  status text not null default 'scheduled' check (status in ('scheduled','sent','failed','canceled')),
  error text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists outbox_due_idx on public.outbox (status, send_at);

alter table public.outbox enable row level security;
drop policy if exists outbox_all on public.outbox;
create policy outbox_all on public.outbox for all to authenticated using (true) with check (true);

-- pg_cron: dispatch due outbox rows every minute via the edge function
create extension if not exists pg_cron;
create extension if not exists pg_net;
do $$
begin
  perform cron.unschedule('dispatch-outbox');
exception when others then null;
end $$;
select cron.schedule('dispatch-outbox', '* * * * *', $$
  select net.http_post(
    url := 'https://caolbpofhfyoxdpeegly.functions.supabase.co/dispatch-outbox',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','bina_dispatch_2026'),
    body := '{}'::jsonb
  );
$$);
