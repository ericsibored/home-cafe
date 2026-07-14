-- ============================================================================
-- Collage → events migration  (group the guest photo wall by event)
-- Run in the Supabase SQL editor. Requires the events table + the original
-- collage_entries table (supabase-collage-migration.sql).
-- Safe to re-run.
-- ============================================================================

-- Associate each photo with an event.
alter table public.collage_entries
  add column if not exists event_id uuid references public.events (id) on delete set null;

-- Backfill existing (pre-event) photos to Vol. 1 — the only event so far.
update public.collage_entries
  set event_id = (select id from public.events where slug = 'vol-1')
  where event_id is null;

create index if not exists collage_entries_event_idx
  on public.collage_entries (event_id, created_at desc);
