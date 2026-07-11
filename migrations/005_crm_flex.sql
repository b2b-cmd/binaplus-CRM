-- ============================================================
-- 005: CRM flexibility — picklists, custom fields, tasks, activities, soft-delete, lecturer role
-- ============================================================

-- lecturer user_type
alter table public.users drop constraint if exists users_user_type_check;
alter table public.users add constraint users_user_type_check
  check (user_type in ('sales','service','general_manager','lecturer'));

-- dynamic picklists (admin-managed dropdown options)
create table if not exists public.picklists (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text,
  options jsonb not null default '[]'
);

-- custom fields (per object) + custom jsonb value column on record tables
create table if not exists public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  object_type text not null,
  key text not null,
  label text not null,
  type text not null default 'text',
  options jsonb default '[]',
  position int default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
do $$ declare t text; begin
  foreach t in array array['people','tickets','orders','payments','opportunities','modules','cycles','products'] loop
    execute format('alter table public.%I add column if not exists custom jsonb not null default ''{}'';', t);
    execute format('alter table public.%I add column if not exists deleted_at timestamptz;', t);
  end loop;
end $$;

-- tasks / reminders (polymorphic)
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text,
  description text,
  object_type text,
  record_id uuid,
  assignee uuid references public.users(id) on delete set null,
  due_date timestamptz,
  status text not null default 'open' check (status in ('open','done')),
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists tasks_assignee_idx on public.tasks(assignee, status);

-- activities feed (polymorphic; generalizes opportunity_notes)
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  object_type text not null,
  record_id uuid not null,
  kind text not null default 'note' check (kind in ('note','task','file','system')),
  author uuid references public.users(id) on delete set null,
  body text,
  file_url text,
  created_at timestamptz not null default now()
);
create index if not exists activities_rec_idx on public.activities(object_type, record_id, created_at desc);

-- migrate existing opportunity_notes into activities
insert into public.activities (object_type, record_id, kind, author, body, file_url, created_at)
  select 'opportunities', opportunity_id, 'note', author, body, file_url, created_at
  from public.opportunity_notes
  on conflict do nothing;

-- RLS
alter table public.picklists     enable row level security;
alter table public.custom_fields enable row level security;
alter table public.tasks         enable row level security;
alter table public.activities    enable row level security;

drop policy if exists picklists_read on public.picklists;
create policy picklists_read on public.picklists for select to authenticated using (true);
drop policy if exists picklists_write on public.picklists;
create policy picklists_write on public.picklists for all to authenticated using (public.is_manager()) with check (public.is_manager());

drop policy if exists cf_read on public.custom_fields;
create policy cf_read on public.custom_fields for select to authenticated using (true);
drop policy if exists cf_write on public.custom_fields;
create policy cf_write on public.custom_fields for all to authenticated using (public.is_manager()) with check (public.is_manager());

drop policy if exists tasks_all on public.tasks;
create policy tasks_all on public.tasks for all to authenticated using (true) with check (true);

drop policy if exists act_read on public.activities;
create policy act_read on public.activities for select to authenticated using (true);
drop policy if exists act_insert on public.activities;
create policy act_insert on public.activities for insert to authenticated with check (true);
drop policy if exists act_update on public.activities;
create policy act_update on public.activities for update to authenticated using (author = public.current_rep_id() or public.is_manager());
drop policy if exists act_delete on public.activities;
create policy act_delete on public.activities for delete to authenticated using (author = public.current_rep_id() or public.is_manager());

-- seed core picklists from current constants
insert into public.picklists (key, label, options) values
  ('ticket_types','סוגי פנייה','["שאלה מקצועית / תוכן","תמיכה טכנית","הרשמה ותשלום","לוח זמנים ומחזור","גישה לפורטל / הקלטות","בקשת ביטול / החזר","שיבוץ מרצה","אחר"]'),
  ('payment_types','אמצעי תשלום','["אשראי","העברה בנקאית","שיק","מזומן","ERN","פיימנט","הוראת קבע","ביט","אחר"]'),
  ('training_types','סוגי הכשרה','["מפתחי AI","מובילי AI","הכשרה דיגיטלית","אחר"]')
  on conflict (key) do nothing;
