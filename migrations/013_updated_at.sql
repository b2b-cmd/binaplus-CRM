-- updateField() stamps updated_at on every save; add it wherever it's missing so saves succeed.
alter table public.users       add column if not exists updated_at timestamptz default now();
alter table public.products    add column if not exists updated_at timestamptz default now();
alter table public.modules     add column if not exists updated_at timestamptz default now();
alter table public.cycles      add column if not exists updated_at timestamptz default now();
alter table public.lessons     add column if not exists updated_at timestamptz default now();
alter table public.payments    add column if not exists updated_at timestamptz default now();
alter table public.cycle_lessons add column if not exists updated_at timestamptz default now();
