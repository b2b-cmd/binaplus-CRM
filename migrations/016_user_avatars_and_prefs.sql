-- 016: profile pictures + per-user UI preferences.

-- Profile picture. Null means "render initials", so there is always something
-- to show and no broken-image state.
alter table users add column if not exists avatar_url text;

-- A stable per-user colour for the initials fallback, so the same person is
-- always the same colour everywhere they appear.
alter table users add column if not exists avatar_hue smallint;

-- Assign a deterministic hue to everyone who does not have one yet.
update users
set avatar_hue = (abs(hashtext(coalesce(full_name, email, id::text))) % 360)
where avatar_hue is null;

-- Per-user UI preferences (which home cards are shown and in what order, etc).
-- jsonb so new preference keys need no further migrations.
alter table users add column if not exists prefs jsonb not null default '{}'::jsonb;
