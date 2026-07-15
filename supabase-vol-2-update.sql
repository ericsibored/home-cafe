-- ============================================================================
-- Lazy Orchard Vol. 2 — real build-your-own + Scallion Pancake
-- Run in the Supabase SQL editor. Safe to re-run.
-- ============================================================================

-- 1. Allow a 'milk' category on the build-your-own matrix.
alter table public.builder_options drop constraint if exists builder_options_category_check;
alter table public.builder_options
  add constraint builder_options_category_check
  check (category in ('base', 'milk', 'syrup', 'modifier'));

-- 2. Rebuild Vol. 2's build-your-own: Matcha/Espresso bases, Fairlife/Oat milk.
delete from public.builder_options
  where event_id = (select id from public.events where slug = 'vol-2');

insert into public.builder_options (event_id, category, name, available, sort_order)
select e.id, x.category, x.name, true, x.ord
from public.events e
cross join (values
  ('base', 'Matcha',   0),
  ('base', 'Espresso', 1),
  ('milk', 'Fairlife', 0),
  ('milk', 'Oat Milk', 1)
) as x(category, name, ord)
where e.slug = 'vol-2';

-- 3. Bring back Scallion Pancake Pastry Rolls (copied verbatim from Vol. 1).
insert into public.menu_items (event_id, name, description, ingredients, sold_out, category, sort_order, details)
select
  (select id from public.events where slug = 'vol-2'),
  mi.name, mi.description, mi.ingredients, false, mi.category,
  (select coalesce(max(sort_order), -1) + 1 from public.menu_items m
     where m.event_id = (select id from public.events where slug = 'vol-2')),
  mi.details
from public.menu_items mi
where mi.event_id = (select id from public.events where slug = 'vol-1')
  and mi.name = 'Scallion Pancake Pastry Rolls'
  and not exists (
    select 1 from public.menu_items m2
    where m2.event_id = (select id from public.events where slug = 'vol-2')
      and m2.name = 'Scallion Pancake Pastry Rolls'
  );
