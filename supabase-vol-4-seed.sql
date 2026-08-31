-- ============================================================================
-- Lazy Orchard Vol. 4 — September 20, 2026
-- Run in the Supabase SQL editor. Idempotent — safe to re-run.
--
-- This file was reconstructed from the live database (Vol. 4 was originally
-- created directly in Supabase rather than from a seed), so it reproduces what
-- is live rather than proposing anything new. Step 4 ACTIVATES Vol. 4.
--
-- Faithfulness notes:
--   * Price scale is preserved as stored: jsonb keeps numeric trailing zeros,
--     so 8.50 and 7.5 round-trip differently. Display is unaffected (the card
--     formats with toFixed(2)), but the stored text stays byte-identical.
--   * Drinks carry "addOns": [] and "tempOptions"; Food rows omit both keys
--     entirely. That asymmetry is intentional here — it mirrors the live rows.
--   * Only the two matcha lattes have image/imageFit; everything else falls
--     back to its emoji tile.
--   * The event's description is NULL (no subtitle renders under the title).
--   * syrup sort_order runs 0, 1, 3 — the gap is reproduced as-is so ordering
--     matches live exactly. Nothing depends on the values being contiguous.
-- ============================================================================

begin;

-- 1. The event -----------------------------------------------------------------
insert into public.events (slug, name, date, description, is_active)
values ('vol-4', 'Lazy Orchard Vol. 4', '2026-09-20', null, false)
on conflict (slug) do update
  set name        = excluded.name,
      date        = excluded.date,
      description = excluded.description;

-- 2. Menu ----------------------------------------------------------------------
insert into public.menu_items
  (event_id, name, description, ingredients, sold_out, category, sort_order, details)
select e.id, x.nm, x.descr, x.ingr, false, x.cat, x.ord, x.details
from public.events e
cross join (values
  (
    'King Jasmine Honeydew',
    'Honeydew juice and jasmine milk tea, topped with salted cream cheese matcha foam and skewered melon.',
    array['honeydew','jasmine tea','milk','cream cheese','matcha']::text[],
    'Drinks', 1,
    '{"emoji":"🍈","price":8.50,"addOns":[],"allergens":["dairy"],"tempOptions":["iced"]}'::jsonb
  ),
  (
    'Watermelon-Coconut',
    'Watermelon juice over coconut milk.',
    array['watermelon','coconut milk']::text[],
    'Drinks', 2,
    '{"emoji":"🍉","price":7.50,"addOns":[],"allergens":[],"tempOptions":["iced"]}'::jsonb
  ),
  (
    'Black Sesame Matcha Latte',
    'Ceremonial matcha over nutty black sesame.',
    array['ceremonial matcha','milk','black sesame']::text[],
    'Drinks', 3,
    '{"image":"/menu/black-sesame-matcha-latte.webp","price":7.5,"addOns":[],"imageFit":"cover","allergens":["dairy","sesame"],"tempOptions":["iced"]}'::jsonb
  ),
  (
    'Passionfruit Matcha Latte',
    'Bright passionfruit layered under ceremonial matcha.',
    array['ceremonial matcha','milk','passionfruit']::text[],
    'Drinks', 4,
    '{"image":"/menu/passionfruit-matcha-latte.webp","price":7.5,"addOns":[],"imageFit":"cover","allergens":[],"tempOptions":["iced"]}'::jsonb
  ),
  (
    'Tamago Sando',
    'Soft milk bread sandwich with a creamy egg salad filling.',
    array['milk bread','egg','mayo']::text[],
    'Food', 5,
    '{"emoji":"🥪","price":6.00,"allergens":["gluten","eggs","dairy"]}'::jsonb
  ),
  (
    'Beef Curry Hand Pies',
    'Flaky hand pies filled with slow-braised beef curry.',
    array['beef','curry','pastry']::text[],
    'Food', 6,
    '{"emoji":"🥟","price":6.50,"allergens":["gluten","dairy"]}'::jsonb
  ),
  (
    -- The $4 slice item. BurntToast's $25 loaf is a separate, hard-coded
    -- listing in EventView.tsx with its own Venmo flow and no row here.
    'Banana Bread',
    'Sticky toffee pudding meets banana bread, made with imported French butter and vanilla.',
    array['banana','flour','butter','eggs']::text[],
    'Food', 7,
    '{"emoji":"🍌","price":4.00,"allergens":["gluten","dairy","eggs"]}'::jsonb
  ),
  (
    'Hojicha Cherry Ice Cream',
    'Hojicha ice cream swirled with tart cherry compote.',
    array['hojicha','cherry','cream']::text[],
    'Food', 8,
    '{"emoji":"🍨","price":5.00,"allergens":["dairy"]}'::jsonb
  )
) as x(nm, descr, ingr, cat, ord, details)
where e.slug = 'vol-4'
  and not exists (
    select 1 from public.menu_items mi
    where mi.event_id = e.id and mi.name = x.nm
  );

-- 3. Build-Your-Own ------------------------------------------------------------
--    base + milk required; syrup + cream optional.
insert into public.builder_options (event_id, category, name, available, sort_order)
select e.id, x.cat, x.nm, true, x.ord
from public.events e
cross join (values
  ('base',  'Matcha',                0),
  -- No espresso at Vol. 4, so that base option is not offered.
  ('milk',  'Fairlife',              0),
  ('milk',  'Oat Milk',              1),
  ('syrup', 'Pandan',                0),
  ('syrup', 'Passionfruit',          1),
  ('syrup', 'Black Sesame',          3),   -- 2 is unused live; kept as-is
  ('cream', 'Whipped cream',         0),
  ('cream', 'Coconut Whipped Cream', 1)
) as x(cat, nm, ord)
where e.slug = 'vol-4'
  and not exists (
    select 1 from public.builder_options bo
    where bo.event_id = e.id and bo.category = x.cat and bo.name = x.nm
  );

-- 4. Go live -------------------------------------------------------------------
--    Two statements: events_single_active is a partial unique index, so the old
--    active row must be cleared before the new one is set.
update public.events set is_active = false where is_active = true and slug <> 'vol-4';
update public.events set is_active = true  where slug = 'vol-4';

commit;

-- 5. Verify --------------------------------------------------------------------
select mi.category, mi.sort_order, mi.name, mi.details->>'price' as price,
       coalesce(mi.details->>'image', concat('emoji ', mi.details->>'emoji')) as art
from public.menu_items mi
join public.events e on e.id = mi.event_id
where e.slug = 'vol-4'
order by mi.sort_order;

select bo.category, bo.sort_order, bo.name
from public.builder_options bo
join public.events e on e.id = bo.event_id
where e.slug = 'vol-4'
order by bo.category, bo.sort_order;
