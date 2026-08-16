-- ============================================================================
-- Lazy Orchard Vol. 3 — menu changes
-- Run AFTER supabase-vol-3-seed.sql (which clones Vol. 2's menu into Vol. 3).
-- Run in the Supabase SQL editor. Idempotent — safe to re-run.
--
-- This applies the Vol. 3 lineup on top of the clone:
--   REMOVE  Banana Milk Thai Tea, Blueberry Matcha, Strawberry Matcha
--   ADD     Pandan Coffee Latte, Black Sesame Matcha Latte,
--           Ube Mango Cheesecake, Black Sesame Banana Bread
--   KEEP    Hojicha Persimmon Latte, Passionfruit Matcha Latte (already cloned)
--
-- Only Vol. 3 rows are touched. Vol. 2 keeps its full menu as an archive, and
-- past orders are unaffected (event_orders stores its own copy of each item).
-- ============================================================================

begin;

-- 1. Remove the three drinks that are not returning ---------------------------
delete from public.menu_items mi
using public.events e
where mi.event_id = e.id
  and e.slug = 'vol-3'
  and mi.name in (
    'Banana Milk Thai Tea',
    'Blueberry Matcha',
    'Strawberry Matcha'
  );


-- 2. Add the four new items ---------------------------------------------------
--    Descriptions, prices and allergens are best guesses — edit before running
--    if you have the real ones. No photos yet, so each shows its emoji tile;
--    add "image" to details later the same way the Vol. 2 photos were wired.
insert into public.menu_items
  (event_id, name, description, ingredients, sold_out, category, sort_order, details)
select
  e.id, x.nm, x.descr, x.ingr, false, x.cat,
  coalesce((select max(m.sort_order) from public.menu_items m where m.event_id = e.id), -1) + x.offset,
  x.details
from public.events e
cross join (values
  (
    'Pandan Coffee Latte',
    'Espresso over pandan-infused milk.',
    array['espresso','milk','pandan']::text[],
    'Drinks', 1,
    '{"emoji":"🌿","price":7.5,"tempOptions":["iced"],"allergens":["dairy"],
      "addOns":["Whipped Cream","Coconut Whipped Cream"]}'::jsonb
  ),
  (
    'Black Sesame Matcha Latte',
    'Ceremonial matcha over nutty black sesame.',
    array['ceremonial matcha','milk','black sesame']::text[],
    'Drinks', 2,
    '{"emoji":"🍵","price":7.5,"tempOptions":["iced"],"allergens":["dairy","sesame"],
      "addOns":["Whipped Cream","Coconut Whipped Cream"]}'::jsonb
  ),
  (
    'Ube Mango Cheesecake',
    'Ube cheesecake layered with ripe mango.',
    array['ube','mango','cream cheese','butter']::text[],
    'Food', 3,
    '{"emoji":"💜","price":6,"allergens":["gluten","dairy","eggs"]}'::jsonb
  ),
  (
    'Black Sesame Banana Bread',
    'Banana bread swirled with black sesame paste.',
    array['banana','black sesame','flour','butter','eggs']::text[],
    'Food', 4,
    '{"emoji":"🍌","price":4,"allergens":["gluten","dairy","eggs","sesame"]}'::jsonb
  )
) as x(nm, descr, ingr, cat, offset, details)
where e.slug = 'vol-3'
  and not exists (
    select 1 from public.menu_items mi
    where mi.event_id = e.id and mi.name = x.nm
  );

commit;


-- 3. Verify -------------------------------------------------------------------
select mi.category, mi.sort_order, mi.name,
       mi.details->>'price' as price,
       coalesce(mi.details->>'image', concat('emoji ', mi.details->>'emoji')) as art
from public.menu_items mi
join public.events e on e.id = mi.event_id
where e.slug = 'vol-3'
order by mi.category, mi.sort_order;
