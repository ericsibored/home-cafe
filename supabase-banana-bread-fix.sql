-- ============================================================================
-- Attach the iced-banana-cakes photo to the $4 Banana Bread item.
-- Run in the Supabase SQL editor. Idempotent — safe to re-run.
--
-- Scoped to the ACTIVE event rather than a slug, because the Vol. 4 rows were
-- created directly in Supabase rather than from a seed file.
--
-- Name and allergens are already correct live ('Banana Bread'; gluten, dairy,
-- eggs), so this only fills in the missing image. BurntToast's $25 loaf is a
-- separate hard-coded listing in EventView.tsx with no menu_items row, so it is
-- unaffected.
-- ============================================================================

update public.menu_items mi
set details = details || '{"image":"/menu/banana-bread-slice.webp","imageFit":"cover"}'::jsonb
from public.events e
where mi.event_id = e.id
  and e.is_active = true
  and mi.name = 'Banana Bread';

-- Verify
select mi.name, mi.details->>'price' as price, mi.details->>'image' as image,
       mi.details->>'allergens' as allergens
from public.menu_items mi
join public.events e on e.id = mi.event_id
where e.is_active = true and mi.category = 'Food'
order by mi.sort_order;
