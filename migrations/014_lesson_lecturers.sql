-- ============================================================
-- 014: lesson lecturers — M2M (lesson × user), mirrors module_lecturers (004)
-- Replaces the single lecturer FK + free-text lecturer_name on lessons.
-- ============================================================
create table if not exists public.lesson_lecturers (
  lesson_id uuid references public.lessons(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  primary key (lesson_id, user_id)
);

-- data migration: seed from the existing single lecturer FK…
insert into public.lesson_lecturers (lesson_id, user_id)
  select id, lecturer from public.lessons where lecturer is not null
  on conflict do nothing;

-- …and from the free-text lecturer_name, exact (trimmed) match to an active user,
-- only where no FK lecturer was set. lecturer_name is kept as a display fallback.
insert into public.lesson_lecturers (lesson_id, user_id)
  select l.id, u.id
  from public.lessons l
  join public.users u on lower(btrim(u.full_name)) = lower(btrim(l.lecturer_name))
  where l.lecturer is null and coalesce(btrim(l.lecturer_name), '') <> ''
  on conflict do nothing;

alter table public.lesson_lecturers enable row level security;
drop policy if exists lesson_lecturers_all on public.lesson_lecturers;
create policy lesson_lecturers_all on public.lesson_lecturers
  for all to authenticated using (true) with check (true);
