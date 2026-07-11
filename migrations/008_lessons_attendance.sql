-- ============================================================
-- 008: lessons (per module) + attendance (lesson × cycle × student)
-- ============================================================

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  position int default 0,
  name text not null,
  description text,
  presentation_url text,
  homework text,
  lecturer uuid references public.users(id) on delete set null,
  custom jsonb not null default '{}',
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists lessons_module_idx on public.lessons(module_id, position);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  present boolean not null default true,
  approved boolean not null default false,   -- אישור חיסור (רלוונטי כש-present=false)
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, cycle_id, person_id)
);
create index if not exists att_person_idx on public.attendance(person_id);
create index if not exists att_cycle_idx on public.attendance(cycle_id);

alter table public.lessons    enable row level security;
alter table public.attendance enable row level security;
do $$ declare t text; begin
  foreach t in array array['lessons','attendance'] loop
    execute format('drop policy if exists %I_all on public.%I;', t, t);
    execute format('create policy %I_all on public.%I for all to authenticated using (true) with check (true);', t, t);
  end loop;
end $$;
