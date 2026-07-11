alter table public.payments add column if not exists opportunity_id uuid references public.opportunities(id) on delete set null;
