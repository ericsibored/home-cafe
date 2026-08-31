-- ============================================================================
-- Vol. 4 has no espresso, so drop that base from Build Your Own.
-- Run in the Supabase SQL editor. Idempotent — safe to re-run.
--
-- Deleted rather than flagged unavailable: an unavailable option still renders
-- as a struck-through "sold out" chip, which is not what we want here. Removing
-- the row hides it outright. Re-running supabase-vol-4-seed.sql will not bring
-- it back — that file no longer lists espresso either.
--
-- Scoped to the ACTIVE event, so past volumes keep espresso in their archive.
-- ============================================================================

delete from public.builder_options bo
using public.events e
where bo.event_id = e.id
  and e.is_active = true
  and bo.category = 'base'
  and bo.name = 'Espresso';

-- Verify — Base should now list Matcha only.
select bo.category, bo.sort_order, bo.name, bo.available
from public.builder_options bo
join public.events e on e.id = bo.event_id
where e.is_active = true
order by bo.category, bo.sort_order;
