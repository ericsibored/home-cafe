-- ============================================================================
-- Lazy Orchard Vol. 3 — August 22, 2026
-- Run in the Supabase SQL editor. Safe to re-run (idempotent throughout).
--
-- Vol. 3 is seeded by CLONING Vol. 2's live menu + build-your-own matrix, so
-- whatever is currently in the DB (including the cherry almond tart and
-- watermelon lychee sorbet added after the original Vol. 2 seed, and every
-- photo/price in `details`) carries over verbatim. Edit from there.
--
-- Step 4 ACTIVATES Vol. 3: it becomes the homepage event and Vol. 2 moves to
-- the /events archive. No code changes are needed — /events/vol-3 and / are
-- both driven off these tables.
--
-- Editing after the fact: change `description` in step 1 for the subtitle;
-- update/delete rows in menu_items where event_id = (vol-3) for the menu.
-- Sold-out toggles are handled live from /admin, not here.
-- ============================================================================

begin;

-- 1. The event -----------------------------------------------------------------
--    EDIT the description below — it renders as the subtitle under the title.
--    (Vol. 1: 'The debut pop-up — Asian-inspired lattes & pastries'
--     Vol. 2: 'Cheers to the friends that brought this collaboration to life')
insert into public.events (slug, name, date, description, is_active)
values (
  'vol-3',
  'Lazy Orchard Vol. 3',
  '2026-08-22',
  'One more pour before summer packs up',
  false                              -- activated in step 4
)
on conflict (slug) do update
  set name        = excluded.name,
      date        = excluded.date,
      description = excluded.description;

-- 2. Menu — clone Vol. 2's items verbatim --------------------------------------
--    sort_order and details (price, image, emoji, allergens, temp/milk options,
--    add-ons) come across unchanged. sold_out resets to false for the new event.
--    Skips any item already on Vol. 3, so re-running won't duplicate and won't
--    clobber edits you've already made.
insert into public.menu_items
  (event_id, name, description, ingredients, sold_out, category, sort_order, details)
select
  v3.id, mi.name, mi.description, mi.ingredients, false, mi.category, mi.sort_order, mi.details
from public.menu_items mi
cross join (select id from public.events where slug = 'vol-3') as v3
where mi.event_id = (select id from public.events where slug = 'vol-2')
  and not exists (
    select 1 from public.menu_items m2
    where m2.event_id = v3.id and m2.name = mi.name
  );

-- 3. Build-Your-Own — clone Vol. 2's matrix ------------------------------------
--    base (Matcha / Espresso) + milk (Fairlife / Oat) required;
--    syrup + cream optional. Everything resets to available = true.
insert into public.builder_options (event_id, category, name, available, sort_order)
select v3.id, bo.category, bo.name, true, bo.sort_order
from public.builder_options bo
cross join (select id from public.events where slug = 'vol-3') as v3
where bo.event_id = (select id from public.events where slug = 'vol-2')
  and not exists (
    select 1 from public.builder_options b2
    where b2.event_id = v3.id and b2.category = bo.category and b2.name = bo.name
  );

-- 4. Go live -------------------------------------------------------------------
--    Two statements, not one: `events_single_active` is a partial unique index,
--    so clearing the old active row must fully commit before the new one is set
--    or the update can trip a duplicate-key error mid-statement.
update public.events set is_active = false where is_active = true and slug <> 'vol-3';
update public.events set is_active = true  where slug = 'vol-3';

commit;

-- 5. Verify --------------------------------------------------------------------
select e.slug, e.name, e.date, e.is_active,
       (select count(*) from public.menu_items      mi where mi.event_id = e.id) as menu_items,
       (select count(*) from public.builder_options bo where bo.event_id = e.id) as builder_options
from public.events e
order by e.date desc;
