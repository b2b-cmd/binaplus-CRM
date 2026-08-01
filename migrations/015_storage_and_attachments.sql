-- 015: let signed-in reps actually upload attachments, and remember what a file was.
--
-- The `attachments` bucket was public for READ but had no INSERT policy, so every
-- upload from the browser failed with "new row violates row-level security policy".
-- ActivityFeed ignored the error and saved the note with file_url = null, which is
-- why attached files silently disappeared. The same bucket backs ticket-reply
-- attachments, so those were failing from the UI as well.

-- ---------- storage policies ----------
drop policy if exists "attachments read"   on storage.objects;
drop policy if exists "attachments insert" on storage.objects;
drop policy if exists "attachments update" on storage.objects;
drop policy if exists "attachments delete" on storage.objects;

-- The bucket is public, so reads stay open (public URLs are embedded in emails).
create policy "attachments read" on storage.objects
  for select using (bucket_id = 'attachments');

create policy "attachments insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments');

create policy "attachments update" on storage.objects
  for update to authenticated
  using (bucket_id = 'attachments');

create policy "attachments delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments');

-- ---------- remember the file, not just its URL ----------
-- Storage keys are ASCII-safe (Supabase rejects non-ASCII), so the original
-- Hebrew filename has to be stored separately or it is lost.
alter table activities add column if not exists file_name text;
alter table activities add column if not exists file_type text;
alter table activities add column if not exists file_size bigint;
