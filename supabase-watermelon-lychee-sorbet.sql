-- ============================================================================
-- Add Watermelon Lychee Sorbet (Food) to Lazy Orchard Vol. 2.
-- Run in the Supabase SQL editor. Idempotent — re-running won't duplicate.
--
-- Picture is TBD: the emoji tile renders until a photo is added. When ready,
-- drop the file in public/menu/ and set details.image to "/menu/<file>".
-- ============================================================================

insert into public.menu_items
  (event_id, name, description, ingredients, sold_out, category, sort_order, details)
select
  e.id,
  'Watermelon Lychee Sorbet',
  'Icy watermelon and lychee, scooped to order.',
  array['watermelon', 'lychee', 'sugar']::text[],
  false,
  'Food',
  coalesce((select max(mi.sort_order) + 1 from public.menu_items mi where mi.event_id = e.id), 0),
  '{"emoji":"🍉","allergens":[]}'::jsonb
from public.events e
where e.slug = 'vol-2'
  and not exists (
    select 1 from public.menu_items mi
    where mi.event_id = e.id and mi.name = 'Watermelon Lychee Sorbet'
  );
