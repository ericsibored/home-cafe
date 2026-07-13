-- ============================================================================
-- Lazy Orchard Vol. 2 — new event seed  (PLACEHOLDERS — fill in your real menu)
-- Run in the Supabase SQL editor. Requires the events / menu_items /
-- builder_options tables (see the other supabase-*-migration.sql files).
--
-- The item rows below are PLACEHOLDERS with the right shape and count
-- (3 specialties; 3 bases, 3 syrups, 2 modifiers). Replace the names,
-- descriptions, ingredients, and details with your real menu, then run.
--
-- HOW TO USE:
--   1. Edit the event details in step 1 (date, description).
--   2. Replace the placeholder Specialties (step 2) and Build-Your-Own
--      options (step 3) with your real menu.
--   3. Run the whole script. It is idempotent — re-running won't duplicate rows.
--   4. When your real items are in, UNCOMMENT step 4 to make Vol. 2 the active
--      event (shown on the homepage). It's commented out so you don't publish
--      placeholders by accident.
--
-- Images: put files in public/menu/ and reference them as "/menu/<file>" in the
-- details JSON. Leave "image" out to fall back to the emoji tile.
-- ============================================================================

-- 1. The event -----------------------------------------------------------------
insert into public.events (slug, name, date, description, is_active)
values (
  'vol-2',
  'Lazy Orchard Vol. 2',
  '2026-09-20',                      -- <-- set the real date
  'Replace with your event subtitle',  -- <-- your subtitle
  false                             -- activated in step 4 (commented out)
)
on conflict (slug) do update
  set name = excluded.name,
      date = excluded.date,
      description = excluded.description;

-- 2. Specialties (menu_items) — REPLACE THESE PLACEHOLDERS ---------------------
--    Columns: name, description, ingredients[], category, sort_order, sold_out, details(jsonb)
--    details keys (all optional): price, image, emoji, calories, allergens[],
--    tempOptions[] ('hot'/'iced'), milkOptions[], addOns[]
insert into public.menu_items
  (event_id, name, description, ingredients, category, sort_order, sold_out, details)
select e.id, x.name, x.description, x.ingredients, x.category, x.ord, false, x.details
from public.events e
cross join (values
  (
    'Specialty 1',                                  -- <-- drink name
    'One-line story / description',                 -- <-- description
    array['ingredient','ingredient']::text[],       -- <-- ingredients
    'Drinks', 0,
    '{"price":0,"emoji":"☕","tempOptions":["hot","iced"],"allergens":[]}'::jsonb
  ),
  (
    'Specialty 2',
    'One-line story / description',
    array['ingredient','ingredient']::text[],
    'Drinks', 1,
    '{"price":0,"emoji":"🥤","tempOptions":["iced"],"allergens":[]}'::jsonb
  ),
  (
    'Specialty 3',
    'One-line story / description',
    array['ingredient','ingredient']::text[],
    'Food', 2,
    '{"price":0,"emoji":"🍪","allergens":[]}'::jsonb
  )
) as x(name, description, ingredients, category, ord, details)
where e.slug = 'vol-2'
  and not exists (
    select 1 from public.menu_items mi
    where mi.event_id = e.id and mi.name = x.name
  );

-- 3. Build-Your-Own options (builder_options) — REPLACE THESE PLACEHOLDERS -----
--    category is 'base' | 'syrup' | 'modifier'. Remove this block for an event
--    with no build-your-own (the section simply won't render).
insert into public.builder_options (event_id, category, name, available, sort_order)
select e.id, x.category, x.name, true, x.ord
from public.events e
cross join (values
  ('base',     'Base 1',     0),
  ('base',     'Base 2',     1),
  ('base',     'Base 3',     2),
  ('syrup',    'Syrup 1',    0),
  ('syrup',    'Syrup 2',    1),
  ('syrup',    'Syrup 3',    2),
  ('modifier', 'Modifier 1', 0),
  ('modifier', 'Modifier 2', 1)
) as x(category, name, ord)
where e.slug = 'vol-2'
  and not exists (
    select 1 from public.builder_options bo
    where bo.event_id = e.id and bo.category = x.category and bo.name = x.name
  );

-- 4. Go live -------------------------------------------------------------------
--    UNCOMMENT once your real items are in. Atomically makes Vol. 2 the only
--    active event (homepage shows it) and deactivates all others.
-- update public.events set is_active = (slug = 'vol-2');
