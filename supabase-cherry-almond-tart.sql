-- ============================================================================
-- Add Cherry Almond Tart (Food) to Lazy Orchard Vol. 2.
-- Run in the Supabase SQL editor. Idempotent — re-running won't duplicate.
--
-- Photo: public/menu/cherry-almond-tart.webp
-- ============================================================================

insert into public.menu_items
  (event_id, name, description, ingredients, sold_out, category, sort_order, details)
select
  e.id,
  'Cherry Almond Tart',
  'Buttery tart shell with almond frangipane and cherries.',
  array['flour', 'butter', 'almond', 'cherry', 'egg', 'sugar']::text[],
  false,
  'Food',
  coalesce((select max(mi.sort_order) + 1 from public.menu_items mi where mi.event_id = e.id), 0),
  '{"emoji":"🍒","image":"/menu/cherry-almond-tart.webp","allergens":["gluten","tree nuts","dairy","eggs"]}'::jsonb
from public.events e
where e.slug = 'vol-2'
  and not exists (
    select 1 from public.menu_items mi
    where mi.event_id = e.id and mi.name = 'Cherry Almond Tart'
  );

-- Point an already-seeded row at the real photo.
update public.menu_items
set details = jsonb_set(details, '{image}', '"/menu/cherry-almond-tart.webp"')
where event_id = (select id from public.events where slug = 'vol-2')
  and name = 'Cherry Almond Tart';
