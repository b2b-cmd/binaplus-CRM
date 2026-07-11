-- ============================================================
-- 004: modules revamp — dedicated fields + M2M (product, lecturer, cycle)
-- ============================================================
alter table public.modules
  add column if not exists title text,
  add column if not exists contents text,          -- תכנים נלמדים
  add column if not exists ai_context text,         -- תוכן רלוונטי (קונטקסט ל-AI)
  add column if not exists presentation_url text,
  add column if not exists homework text,           -- תרגול ושיעורי בית
  add column if not exists notes text;

create table if not exists public.module_products (
  module_id uuid references public.modules(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  primary key (module_id, product_id)
);
create table if not exists public.module_lecturers (
  module_id uuid references public.modules(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  primary key (module_id, user_id)
);
create table if not exists public.cycle_modules (
  cycle_id uuid references public.cycles(id) on delete cascade,
  module_id uuid references public.modules(id) on delete cascade,
  primary key (cycle_id, module_id)
);

-- seed existing single product_id links into module_products
insert into public.module_products (module_id, product_id)
  select id, product_id from public.modules where product_id is not null
  on conflict do nothing;

alter table public.module_products  enable row level security;
alter table public.module_lecturers enable row level security;
alter table public.cycle_modules    enable row level security;
do $$ declare t text; begin
  foreach t in array array['module_products','module_lecturers','cycle_modules'] loop
    execute format('drop policy if exists %I_all on public.%I;', t, t);
    execute format('create policy %I_all on public.%I for all to authenticated using (true) with check (true);', t, t);
  end loop;
end $$;
