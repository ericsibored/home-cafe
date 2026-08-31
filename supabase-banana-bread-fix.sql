-- ============================================================================
-- Fix the $4 banana bread item (the iced banana cakes).
-- Run in the Supabase SQL editor. Idempotent — safe to re-run.
--
-- Scoped to whichever event is ACTIVE, not to a hard-coded slug, because the
-- Vol. 4 menu rows were created directly in Supabase rather than from a file
-- in this repo. That also makes this safe to run again on a later volume.
--
-- Not to be confused with BurntToast's $25 loaf: that one is hard-coded in
-- EventView.tsx with its own Venmo flow and no menu_items row, so nothing here
-- touches it.
--
-- EDIT THE NAME BELOW if you want something other than 'Banana Bread Bites'.
-- ============================================================================

update public.menu_items mi
set name        = 'Banana Bread Bites',
    description = 'Banana-shaped cakes, iced by hand.',
    ingredients = array['banana','flour','butter','eggs','sugar']::text[],
    -- Replaces the allergens key outright, dropping the stale 'sesame' entry.
    details     = details || '{"image":"/menu/banana-bread-slice.webp","imageFit":"cover","allergens":["gluten","dairy","eggs"]}'::jsonb
from public.events e
where mi.event_id = e.id
  and e.is_active = true
  and mi.name in ('Black Sesame Banana Bread', 'Banana Bread Bites');

-- Verify
select e.slug as event, mi.name, mi.details->>'price' as price,
       mi.details->>'image' as image, mi.details->>'allergens' as allergens
from public.menu_items mi
join public.events e on e.id = mi.event_id
where e.is_active = true
order by mi.category, mi.sort_order;
