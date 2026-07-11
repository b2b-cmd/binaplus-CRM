-- ============================================================
-- 009: flat lessons per product + cycle_lessons schedule (dates)
-- ============================================================

-- lessons → flat, product-scoped canonical מפגשים
alter table public.lessons
  add column if not exists product_id uuid references public.products(id) on delete cascade,
  add column if not exists number int,
  add column if not exists type text,
  add column if not exists content text,
  add column if not exists lecturer_name text;
alter table public.lessons alter column module_id drop not null;
create index if not exists lessons_product_idx on public.lessons (product_id, number);

-- cycle_lessons = a lesson scheduled in a cycle on a date (the "session/occurrence")
create table if not exists public.cycle_lessons (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  seq int,
  session_date date,
  start_time text,
  end_time text,
  lecturer text,
  presentation_url text,
  improvement_notes text,
  created_at timestamptz not null default now(),
  unique (cycle_id, lesson_id)
);
create index if not exists cl_cycle_idx on public.cycle_lessons (cycle_id, seq);
create index if not exists cl_lesson_idx on public.cycle_lessons (lesson_id);

-- RLS: authenticated read/write (same pattern as catalog tables)
alter table public.cycle_lessons enable row level security;
drop policy if exists cl_read on public.cycle_lessons;
create policy cl_read on public.cycle_lessons for select to authenticated using (true);
drop policy if exists cl_write on public.cycle_lessons;
create policy cl_write on public.cycle_lessons for all to authenticated using (true) with check (true);
