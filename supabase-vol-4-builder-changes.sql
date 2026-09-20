-- ============================================================================
-- Vol. 4 Build Your Own changes.
-- Run in the Supabase SQL editor. Idempotent — safe to re-run.
--
--   * Hojicha replaces Espresso as a base.
--   * Pandan is removed from the syrups.
--
-- The hojicha swap is two statements so it works from either starting state:
-- if the Espresso row still exists it is renamed in place (keeping its
-- sort_order), and if it was already deleted, Hojicha is inserted instead.
-- Exactly one of the two does any work.
--
-- Scoped to the ACTIVE event, so past volumes keep their options archived.
-- ============================================================================

begin;

-- Rename espresso -> hojicha when that row is still present.
update public.builder_options bo
set name = 'Hojicha'
from public.events e
where bo.event_id = e.id
  and e.is_active = true
  and bo.category = 'base'
  and bo.name = 'Espresso'
  and not exists (
    select 1 from public.builder_options b2
    where b2.event_id = bo.event_id and b2.category = 'base' and b2.name = 'Hojicha'
  );

-- Otherwise add hojicha.
insert into public.builder_options (event_id, category, name, available, sort_order)
select e.id, 'base', 'Hojicha', true, 1
from public.events e
where e.is_active = true
  and not exists (
    select 1 from public.builder_options bo
    where bo.event_id = e.id and bo.category = 'base' and bo.name = 'Hojicha'
  );

-- Drop the pandan syrup. Deleted rather than flagged unavailable, since an
-- unavailable option still renders as a struck-through "sold out" chip.
delete from public.builder_options bo
using public.events e
where bo.event_id = e.id
  and e.is_active = true
  and bo.category = 'syrup'
  and bo.name = 'Pandan';

commit;

-- Verify — Base: Matcha, Hojicha. Syrup: Passionfruit, Black Sesame.
select bo.category, bo.sort_order, bo.name, bo.available
from public.builder_options bo
join public.events e on e.id = bo.event_id
where e.is_active = true
order by bo.category, bo.sort_order;
