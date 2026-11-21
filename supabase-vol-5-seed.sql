-- ============================================================================
-- Lazy Orchard Vol. 5 — seed
-- Run in the Supabase SQL editor. Idempotent — safe to re-run.
--
-- Vol. 5 is seeded by CLONING Vol. 4's live menu + build-your-own matrix, then
-- trimming and adding. Vol. 4 is left untouched as its own archive.
--
--   KEPT      Passionfruit Matcha Latte (drink), Beef Curry Tarts (food)
--   DROPPED   everything else from Vol. 4: Honeydeuce Matcha Latte,
--             Black Sesame Matcha Latte, Banana Bread, Tamago Egg Sando,
--             Hojicha Cherry Ice Cream
--   NEW       Brown Sugar Chestnut Latte (limited stock)
--             Strawberry Shortcake Matcha Latte  (reuses the Vol. 3 photo)
--             Pandan Coffee Latte                (reuses the Vol. 3 photo)
--             Poached Pear Tart
--             Caramelized Shallot, Sage & Gruyère Quiche
--             Fall Pumpkin Swirl Cheesecake
--
-- Step 5 ACTIVATES Vol. 5 and archives Vol. 4 to /events.
--
-- Note: BurntToast's loaf section is hard-coded to the vol-4 slug in
-- EventView.tsx, so it disappears on Vol. 5 by itself — nothing to remove here.
-- ============================================================================

begin;

-- 1. The event -----------------------------------------------------------------
insert into public.events (slug, name, date, description, is_active)
values (
  'vol-5',
  'Lazy Orchard Vol. 5',
  '2026-11-21',
  null,                    -- subtitle; null renders nothing
  false                    -- activated in step 5
)
on conflict (slug) do update
  set name        = excluded.name,
      date        = excluded.date,
      description = excluded.description;

-- 2. Carry over the two returning items from Vol. 4 ----------------------------
--    An allow-list, not a deny-list: only these two come across, with their
--    photos, prices and copy intact. Everything else from Vol. 4 is retired.
insert into public.menu_items
  (event_id, name, description, ingredients, sold_out, category, sort_order, details)
select v5.id, mi.name, mi.description, mi.ingredients, false, mi.category, k.ord, mi.details
from public.menu_items mi
cross join (select id from public.events where slug = 'vol-5') as v5
join (values
  ('Passionfruit Matcha Latte', 1),
  ('Beef Curry Tarts',          3)
) as k(nm, ord) on k.nm = mi.name
where mi.event_id = (select id from public.events where slug = 'vol-4')
  and not exists (
    select 1 from public.menu_items m2
    where m2.event_id = v5.id and m2.name = mi.name
  );

-- 3. New for Vol. 5 ------------------------------------------------------------
--    The chestnut latte carries "limitedStock": true, which renders a LIMITED
--    badge in the corner of its image. Neither has a photo yet, so both fall
--    back to their emoji tile.
insert into public.menu_items
  (event_id, name, description, ingredients, sold_out, category, sort_order, details)
select e.id, x.nm, x.descr, x.ingr, false, x.cat, x.ord, x.details
from public.events e
cross join (values
  (
    'Brown Sugar Chestnut Latte',
    'Roasted chestnut and brown sugar under ceremonial matcha.',
    array['ceremonial matcha','roasted chestnut','brown sugar','milk']::text[],
    'Drinks', 2,
    '{"emoji":"🌰","price":7.5,"addOns":[],"limitedStock":true,"allergens":["dairy"],"tempOptions":["iced"]}'::jsonb
  ),
  (
    'Poached Pear Tart',
    'Almond flour base with vanilla frangipane and poached Asian pears.',
    array['almond flour','vanilla','frangipane','asian pear','butter','eggs']::text[],
    'Food', 4,
    -- Almond flour base, so no wheat: nuts rather than gluten.
    '{"emoji":"🍐","price":6.00,"allergens":["nuts","dairy","eggs"]}'::jsonb
  ),
  (
    -- Reuses the Vol. 3 strawberry matcha photo.
    'Strawberry Shortcake Matcha Latte',
    'Ceremonial matcha over strawberry and sweet cream.',
    array['ceremonial matcha','strawberry','milk','cream']::text[],
    'Drinks', 5,
    '{"emoji":"🍓","price":7.5,"addOns":[],"image":"/menu/strawberry-matcha.webp","imageFit":"cover","allergens":["dairy"],"tempOptions":["iced"]}'::jsonb
  ),
  (
    -- Reuses the Vol. 3 pandan latte photo.
    'Pandan Coffee Latte',
    'Espresso over pandan-infused milk.',
    array['espresso','milk','pandan']::text[],
    'Drinks', 6,
    '{"emoji":"🌿","price":7.5,"addOns":[],"image":"/menu/pandan-coffee-latte.webp","imageFit":"cover","allergens":["dairy"],"tempOptions":["hot","iced"]}'::jsonb
  ),
  (
    'Caramelized Shallot, Sage & Gruyère Quiche',
    'Slow-caramelized shallots, sage and gruyère in a savory custard tart.',
    array['shallot','sage','gruyère','egg','cream','butter','pastry']::text[],
    'Food', 7,
    '{"emoji":"🥧","price":6.50,"image":"/menu/shallot-gruyere-quiche.webp","imageFit":"cover","allergens":["gluten","dairy","eggs"]}'::jsonb
  ),
  (
    'Fall Pumpkin Swirl Cheesecake',
    'Pumpkin swirled through vanilla cheesecake on a graham crust.',
    array['pumpkin','cream cheese','graham','butter','eggs']::text[],
    'Food', 8,
    '{"emoji":"🎃","price":6.00,"image":"/menu/pumpkin-swirl-cheesecake.webp","imageFit":"cover","allergens":["gluten","dairy","eggs"]}'::jsonb
  )
) as x(nm, descr, ingr, cat, ord, details)
where e.slug = 'vol-5'
  and not exists (
    select 1 from public.menu_items mi
    where mi.event_id = e.id and mi.name = x.nm
  );

-- 4. Build-Your-Own — clone Vol. 4's matrix ------------------------------------
--    Vol. 4 dropped espresso in favour of hojicha; Vol. 5 brings it back, so
--    the bases end up Matcha / Hojicha / Espresso.
insert into public.builder_options (event_id, category, name, available, sort_order)
select v5.id, bo.category, bo.name, true, bo.sort_order
from public.builder_options bo
cross join (select id from public.events where slug = 'vol-5') as v5
where bo.event_id = (select id from public.events where slug = 'vol-4')
  and not exists (
    select 1 from public.builder_options b2
    where b2.event_id = v5.id and b2.category = bo.category and b2.name = bo.name
  );

-- Espresso returns as a base for Vol. 5 (the pandan latte is espresso-based).
insert into public.builder_options (event_id, category, name, available, sort_order)
select e.id, 'base', 'Espresso', true, 2
from public.events e
where e.slug = 'vol-5'
  and not exists (
    select 1 from public.builder_options bo
    where bo.event_id = e.id and bo.category = 'base' and bo.name = 'Espresso'
  );

-- Passionfruit syrup — ensure it is on the Vol. 5 syrup list even if it was not
-- part of Vol. 4's matrix. sort_order lands after the existing syrups.
insert into public.builder_options (event_id, category, name, available, sort_order)
select e.id, 'syrup', 'Passionfruit Syrup', true,
       coalesce((select max(bo2.sort_order) from public.builder_options bo2
                 where bo2.event_id = e.id and bo2.category = 'syrup'), 0) + 1
from public.events e
where e.slug = 'vol-5'
  and not exists (
    select 1 from public.builder_options bo
    where bo.event_id = e.id and bo.category = 'syrup'
      and bo.name in ('Passionfruit Syrup', 'Passionfruit')
  );

commit;

-- 5. Go live -------------------------------------------------------------------
--    Makes Vol. 5 the homepage event and moves Vol. 4 to /events as an archive.
--    Two statements, because events_single_active is a partial unique index: the
--    old active row must be cleared before the new one is set.
update public.events set is_active = false where is_active = true and slug <> 'vol-5';
update public.events set is_active = true  where slug = 'vol-5';

-- 6. Check your work -----------------------------------------------------------
select mi.category, mi.sort_order, mi.name, mi.details->>'price' as price,
       coalesce(mi.details->>'image', concat('emoji ', mi.details->>'emoji')) as art,
       mi.details->>'limitedStock' as limited
from public.menu_items mi
join public.events e on e.id = mi.event_id
where e.slug = 'vol-5'
order by mi.category, mi.sort_order;

select bo.category, bo.sort_order, bo.name
from public.builder_options bo
join public.events e on e.id = bo.event_id
where e.slug = 'vol-5'
order by bo.category, bo.sort_order;
