-- ============================================================================
-- Supabase health check — read-only. Nothing here writes.
-- Run the blocks individually in the SQL editor and read the notes.
-- ============================================================================

-- 1. Row Level Security: any PUBLIC table without RLS is readable/writable by
--    anyone holding the anon key, which ships in the browser bundle.
--    Expect rls_enabled = true on every row below.
select c.relname as table_name, c.relrowsecurity as rls_enabled,
       (select count(*) from pg_policies p
        where p.schemaname = 'public' and p.tablename = c.relname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relrowsecurity, c.relname;

-- 2. What anon can actually do. Watch for INSERT/UPDATE/DELETE on tables that
--    should be read-only to guests, and any SELECT on event_orders (it holds
--    guest names and should never be publicly readable).
select table_name, privilege_type
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public'
order by table_name, privilege_type;

-- 3. Exactly one active event, or the homepage picks arbitrarily.
select slug, name, date, is_active
from public.events order by date desc;

-- 4. Orphans: menu items and builder options pointing at no event.
select 'menu_items' as tbl, count(*) as orphaned
from public.menu_items mi
where not exists (select 1 from public.events e where e.id = mi.event_id)
union all
select 'builder_options', count(*)
from public.builder_options bo
where not exists (select 1 from public.events e where e.id = bo.event_id);

-- 5. Image paths referenced by the DB. Cross-check against public/menu/ before
--    deleting any file: a path with no file renders a broken tile on that
--    event's page, including archived volumes.
select distinct mi.details->>'image' as image_path,
       string_agg(distinct e.slug, ', ' order by e.slug) as used_by
from public.menu_items mi
join public.events e on e.id = mi.event_id
where mi.details ? 'image'
group by 1
order by 1;

-- 6. Items with neither image nor emoji fall back to a generic cup.
select e.slug, mi.name
from public.menu_items mi
join public.events e on e.id = mi.event_id
where not (mi.details ? 'image') and not (mi.details ? 'emoji')
order by e.slug, mi.sort_order;

-- 7. Priceless items (render with no price line).
select e.slug, mi.category, mi.name
from public.menu_items mi
join public.events e on e.id = mi.event_id
where not (mi.details ? 'price')
order by e.slug, mi.sort_order;

-- 8. Orders still pending on events that are over — stale queue rows.
select e.slug, e.date, count(*) as pending
from public.event_orders o
join public.events e on e.id = o.event_id
where o.status = 'pending' and e.is_active = false
group by e.slug, e.date
order by e.date desc;

-- 9. Photo-wall volume and size. /api/collage accepts uploads from anyone who
--    can reach the site, with no size cap or rate limit, so this is the number
--    to watch if storage grows unexpectedly.
select count(*) as entries,
       count(distinct guest_name) as contributors,
       min(created_at) as first, max(created_at) as latest
from public.collage_entries;

-- 10. Likely test rows: orders placed on a different day than their event.
select e.slug, o.guest_name, o.label, o.created_at
from public.event_orders o
join public.events e on e.id = o.event_id
where o.created_at::date <> e.date
order by o.created_at desc
limit 50;
