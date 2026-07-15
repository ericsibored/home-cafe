-- ============================================================================
-- Lazy Orchard Vol. 2 — real drinks + build-your-own
-- Run in the Supabase SQL editor. Safe to re-run.
-- ============================================================================

-- 1. Allow 'milk' and 'cream' categories on the build-your-own matrix.
alter table public.builder_options drop constraint if exists builder_options_category_check;
alter table public.builder_options
  add constraint builder_options_category_check
  check (category in ('base', 'milk', 'syrup', 'cream', 'modifier'));

-- 2. Rebuild Vol. 2's build-your-own.
--    base (Matcha/Espresso) + milk (Fairlife/Oat) required; syrup + cream optional.
delete from public.builder_options
  where event_id = (select id from public.events where slug = 'vol-2');

insert into public.builder_options (event_id, category, name, available, sort_order)
select e.id, x.category, x.name, true, x.ord
from public.events e
cross join (values
  ('base',  'Matcha',        0),
  ('base',  'Espresso',      1),
  ('milk',  'Fairlife',      0),
  ('milk',  'Oat Milk',      1),
  ('syrup', 'Blueberry',     0),
  ('cream', 'Whipped cream', 0)   -- PLACEHOLDER cream top — fill in your real options
) as x(category, name, ord)
where e.slug = 'vol-2';

-- 3. Vol. 2 drinks — remove placeholders, add the real lineup.
delete from public.menu_items
  where event_id = (select id from public.events where slug = 'vol-2')
    and name in ('Specialty 1', 'Specialty 2', 'Specialty 3');

-- Banana Milk Thai Tea (new) — description/emoji are best guesses, edit freely.
insert into public.menu_items (event_id, name, description, ingredients, sold_out, category, sort_order, details)
select (select id from public.events where slug = 'vol-2'),
  'Banana Milk Thai Tea', 'Thai tea poured over sweet banana milk',
  array['thai tea', 'banana milk']::text[], false, 'Drinks', 0,
  '{"emoji":"🧋","tempOptions":["iced"],"allergens":["dairy"]}'::jsonb
where not exists (select 1 from public.menu_items
  where event_id = (select id from public.events where slug = 'vol-2') and name = 'Banana Milk Thai Tea');

-- Hojicha Persimmon Latte — copied verbatim (image + description) from Vol. 1.
insert into public.menu_items (event_id, name, description, ingredients, sold_out, category, sort_order, details)
select (select id from public.events where slug = 'vol-2'),
  mi.name, mi.description, mi.ingredients, false, mi.category, 1, mi.details
from public.menu_items mi
where mi.event_id = (select id from public.events where slug = 'vol-1')
  and mi.name = 'Hojicha Persimmon Latte'
  and not exists (select 1 from public.menu_items m2
    where m2.event_id = (select id from public.events where slug = 'vol-2') and m2.name = 'Hojicha Persimmon Latte');

-- Blueberry Matcha (new) — description/emoji are best guesses, edit freely.
insert into public.menu_items (event_id, name, description, ingredients, sold_out, category, sort_order, details)
select (select id from public.events where slug = 'vol-2'),
  'Blueberry Matcha', 'Ceremonial matcha latte with blueberry',
  array['ceremonial matcha', 'milk', 'blueberry']::text[], false, 'Drinks', 2,
  '{"emoji":"🫐","tempOptions":["hot","iced"],"allergens":["dairy"]}'::jsonb
where not exists (select 1 from public.menu_items
  where event_id = (select id from public.events where slug = 'vol-2') and name = 'Blueberry Matcha');

-- 4. Scallion Pancake Pastry Rolls (Food) — copied verbatim from Vol. 1.
insert into public.menu_items (event_id, name, description, ingredients, sold_out, category, sort_order, details)
select (select id from public.events where slug = 'vol-2'),
  mi.name, mi.description, mi.ingredients, false, mi.category, 3, mi.details
from public.menu_items mi
where mi.event_id = (select id from public.events where slug = 'vol-1')
  and mi.name = 'Scallion Pancake Pastry Rolls'
  and not exists (select 1 from public.menu_items m2
    where m2.event_id = (select id from public.events where slug = 'vol-2') and m2.name = 'Scallion Pancake Pastry Rolls');
