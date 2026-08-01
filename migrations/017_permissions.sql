-- 017: dynamic per-role / per-user permissions.
--
-- Until now every signed-in rep saw every screen. A sales rep has no reason to
-- see the knowledge base or attendance, and a service rep has no reason to see
-- orders and payments. This makes visibility and allowed actions configurable
-- instead of hard-coded.

create table if not exists permissions (
  id          uuid primary key default gen_random_uuid(),
  -- 'role'  -> scope_key is a users.user_type   (sales / service / general_manager)
  -- 'user'  -> scope_key is a users.id, and overrides the role row
  scope       text not null check (scope in ('role', 'user')),
  scope_key   text not null,
  resource    text not null,
  can_view    boolean not null default true,
  can_create  boolean not null default true,
  can_edit    boolean not null default true,
  can_delete  boolean not null default false,
  can_export  boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (scope, scope_key, resource)
);

create index if not exists permissions_lookup on permissions (scope, scope_key);

alter table permissions enable row level security;

-- Everyone signed in must be able to READ permissions, otherwise the app cannot
-- decide what to render for them.
drop policy if exists "permissions read" on permissions;
create policy "permissions read" on permissions
  for select to authenticated using (true);

-- Only managers may change them.
drop policy if exists "permissions write" on permissions;
create policy "permissions write" on permissions
  for all to authenticated
  using (exists (
    select 1 from users u
    where u.auth_id = auth.uid()
      and (u.permission_level in ('system_admin', 'team_manager') or u.user_type = 'general_manager')
  ))
  with check (exists (
    select 1 from users u
    where u.auth_id = auth.uid()
      and (u.permission_level in ('system_admin', 'team_manager') or u.user_type = 'general_manager')
  ));

-- ---------- sensible defaults per role ----------
-- general_manager sees everything; sales and service get the subset that matches
-- how they actually work. Anything not listed falls back to "hidden" for the
-- non-manager roles, so adding a new screen does not silently expose it.
insert into permissions (scope, scope_key, resource, can_view, can_create, can_edit, can_delete, can_export)
values
  -- sales: the sales pipeline + the catalogue they quote from + their own tasks
  ('role','sales','dashboard',    true,  false, false, false, true),
  ('role','sales','people',       true,  true,  true,  false, true),
  ('role','sales','opportunities',true,  true,  true,  false, true),
  ('role','sales','orders',       true,  true,  true,  false, true),
  ('role','sales','payments',     true,  true,  true,  false, true),
  ('role','sales','products',     true,  false, false, false, true),
  ('role','sales','cycles',       true,  false, false, false, true),
  ('role','sales','tasks',        true,  true,  true,  true,  true),
  ('role','sales','tickets',      false, false, false, false, false),
  ('role','sales','lessons',      false, false, false, false, false),
  ('role','sales','attendance',   false, false, false, false, false),
  ('role','sales','knowledge_base',false,false, false, false, false),
  ('role','sales','users',        false, false, false, false, false),
  ('role','sales','settings',     false, false, false, false, false),

  -- service: tickets + the knowledge and catalogue context needed to answer them
  ('role','service','dashboard',    true,  false, false, false, true),
  ('role','service','tickets',      true,  true,  true,  false, true),
  ('role','service','people',       true,  false, true,  false, true),
  ('role','service','tasks',        true,  true,  true,  true,  true),
  ('role','service','knowledge_base',true, true,  true,  false, true),
  ('role','service','products',     true,  false, false, false, true),
  ('role','service','cycles',       true,  false, false, false, true),
  ('role','service','lessons',      true,  false, false, false, true),
  ('role','service','attendance',   true,  true,  true,  false, true),
  ('role','service','opportunities',false, false, false, false, false),
  ('role','service','orders',       false, false, false, false, false),
  ('role','service','payments',     false, false, false, false, false),
  ('role','service','users',        false, false, false, false, false),
  ('role','service','settings',     false, false, false, false, false),

  -- general_manager: everything, including destructive actions
  ('role','general_manager','dashboard',    true, true, true, true, true),
  ('role','general_manager','people',       true, true, true, true, true),
  ('role','general_manager','tickets',      true, true, true, true, true),
  ('role','general_manager','opportunities',true, true, true, true, true),
  ('role','general_manager','orders',       true, true, true, true, true),
  ('role','general_manager','payments',     true, true, true, true, true),
  ('role','general_manager','products',     true, true, true, true, true),
  ('role','general_manager','cycles',       true, true, true, true, true),
  ('role','general_manager','lessons',      true, true, true, true, true),
  ('role','general_manager','attendance',   true, true, true, true, true),
  ('role','general_manager','knowledge_base',true,true, true, true, true),
  ('role','general_manager','tasks',        true, true, true, true, true),
  ('role','general_manager','users',        true, true, true, true, true),
  ('role','general_manager','settings',     true, true, true, true, true)
on conflict (scope, scope_key, resource) do nothing;
