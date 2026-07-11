-- custom field grid layout: width (1=half, 2=full) + ensure position exists
alter table public.custom_fields add column if not exists width int not null default 1;
alter table public.custom_fields add column if not exists position int not null default 0;
