-- 010_ui.sql — UX overhaul support
-- Tasks: urgency + (assignee already exists). Activities: note threads (parent_id).
-- Soft-delete guards for records the user creates and must be able to delete.

alter table tasks      add column if not exists urgency text default 'med';
alter table activities add column if not exists parent_id uuid references activities(id) on delete cascade;

-- deleted_at exists on most record tables (migration 005); ensure it on the three
-- the user creates from a record screen and needs to remove.
alter table opportunities add column if not exists deleted_at timestamptz;
alter table orders        add column if not exists deleted_at timestamptz;
alter table payments      add column if not exists deleted_at timestamptz;

create index if not exists activities_parent_idx on activities(parent_id);
