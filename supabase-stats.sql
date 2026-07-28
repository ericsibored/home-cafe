-- ============================================================================
-- Lazy Orchard Café — event stats
-- Run any block on its own in the Supabase SQL editor.
--
-- Notes on the data model, so the numbers mean what you expect:
--   * event_orders holds ONE ROW PER CART LINE. A guest who ordered three
--     drinks in one checkout produces three rows.
--   * Quantity lives in item_summary->>'quantity' and is ABSENT when it is 1,
--     so always read it as coalesce((item_summary->>'quantity')::int, 1).
--   * A "ticket" (one checkout) = same guest_name + same created_at, because
--     every line of a checkout is written in a single INSERT.
-- ============================================================================


-- 1. Headline numbers per event ---------------------------------------------
select
  e.name                                                as event,
  e.date,
  count(distinct (o.guest_name, o.created_at))          as tickets,
  count(*)                                              as line_items,
  sum(coalesce((o.item_summary->>'quantity')::int, 1))  as drinks_made,
  count(distinct o.guest_name)                          as guests,
  round(avg(coalesce((o.item_summary->>'quantity')::int, 1)), 2) as avg_qty_per_line
from public.events e
join public.event_orders o on o.event_id = e.id
group by e.id, e.name, e.date
order by e.date;


-- 2. Most popular items (across all events) ----------------------------------
--    Uses the specialty name, or 'Build your own' for builder drinks.
select
  coalesce(o.item_summary->>'name', 'Build your own')   as item,
  o.item_type,
  count(*)                                              as times_ordered,
  sum(coalesce((o.item_summary->>'quantity')::int, 1))  as units
from public.event_orders o
group by 1, 2
order by units desc;


-- 3. Most popular items, split by event --------------------------------------
select
  e.name                                               as event,
  coalesce(o.item_summary->>'name', 'Build your own')  as item,
  sum(coalesce((o.item_summary->>'quantity')::int, 1)) as units
from public.event_orders o
join public.events e on e.id = o.event_id
group by 1, 2
order by e.name, units desc;


-- 4. Build-your-own: which components people actually pick -------------------
--    One row per component value, e.g. base=Matcha, syrup=Blueberry.
select
  component,
  value,
  count(*)                                              as picks,
  sum(coalesce((o.item_summary->>'quantity')::int, 1))  as units
from public.event_orders o
cross join lateral (values
  ('base',     o.item_summary->>'base'),
  ('milk',     o.item_summary->>'milk'),
  ('syrup',    o.item_summary->>'syrup'),
  ('cream',    o.item_summary->>'cream'),
  ('modifier', o.item_summary->>'modifier')
) as x(component, value)
where o.item_type = 'builder' and x.value is not null
group by component, value
order by component, units desc;


-- 5. Full build-your-own combinations ----------------------------------------
select
  concat_ws(' + ',
    o.item_summary->>'base', o.item_summary->>'milk', o.item_summary->>'syrup',
    o.item_summary->>'cream', o.item_summary->>'modifier')  as combo,
  count(*)                                                  as times_ordered
from public.event_orders o
where o.item_type = 'builder'
group by 1
order by times_ordered desc;


-- 6. Add-on attach rate (drinks only) ----------------------------------------
select
  count(*) filter (where o.item_summary ? 'addOns')                as with_addons,
  count(*)                                                         as specialty_orders,
  round(100.0 * count(*) filter (where o.item_summary ? 'addOns')
        / nullif(count(*), 0), 1)                                  as pct_with_addons
from public.event_orders o
where o.item_type = 'specialty';

--    …and which add-on wins
select addon, count(*) as picks
from public.event_orders o
cross join lateral jsonb_array_elements_text(o.item_summary->'addOns') as addon
group by addon
order by picks desc;


-- 7. Hot vs iced --------------------------------------------------------------
select
  coalesce(o.item_summary->>'temp', 'unspecified')      as temp,
  sum(coalesce((o.item_summary->>'quantity')::int, 1))  as units
from public.event_orders o
group by 1
order by units desc;


-- 8. Ticket size distribution — how many items per checkout ------------------
with tickets as (
  select o.guest_name, o.created_at, count(*) as items
  from public.event_orders o
  group by o.guest_name, o.created_at
)
select items as items_per_ticket, count(*) as tickets
from tickets
group by items
order by items;


-- 9. Rush hours — orders by 15-minute bucket ---------------------------------
--    Swap the interval or add a timezone if UTC buckets read oddly.
select
  e.name                                                as event,
  to_char(date_trunc('hour', o.created_at)
    + floor(extract(minute from o.created_at) / 15) * interval '15 min',
    'YYYY-MM-DD HH24:MI')                               as bucket,
  count(*)                                              as line_items
from public.event_orders o
join public.events e on e.id = o.event_id
group by 1, 2
order by 2;


-- 10. Busiest guests ----------------------------------------------------------
select
  o.guest_name,
  count(distinct (o.guest_name, o.created_at))          as tickets,
  sum(coalesce((o.item_summary->>'quantity')::int, 1))  as drinks,
  count(distinct o.event_id)                            as events_attended
from public.event_orders o
group by o.guest_name
order by drinks desc;


-- 11. Repeat guests — same name across both events ----------------------------
select o.guest_name, count(distinct o.event_id) as events_attended
from public.event_orders o
group by o.guest_name
having count(distinct o.event_id) > 1
order by events_attended desc, o.guest_name;


-- 12. Fulfillment — anything left pending ------------------------------------
select e.name as event, o.status, count(*) as line_items
from public.event_orders o
join public.events e on e.id = o.event_id
group by 1, 2
order by 1, 2;


-- 13. Notional revenue at menu prices ----------------------------------------
--     Everything is free in practice; this is "what it would have rung up".
--     Builder drinks are priced at the flat BUILDER_PRICE in the app ($7.50).
select
  e.name                                                as event,
  round(sum(
    coalesce((o.item_summary->>'quantity')::int, 1)
    * coalesce((mi.details->>'price')::numeric, 7.50)
  ), 2)                                                 as notional_revenue
from public.event_orders o
join public.events e on e.id = o.event_id
left join public.menu_items mi
  on mi.event_id = o.event_id and mi.name = o.item_summary->>'name'
group by 1
order by 1;


-- 14. Photo wall participation ------------------------------------------------
select
  e.name                        as event,
  count(c.id)                   as photos,
  count(distinct c.guest_name)  as contributors
from public.events e
left join public.collage_entries c on c.event_id = e.id
group by e.id, e.name, e.date
order by e.date;


-- 15. Menu coverage — what never got ordered ----------------------------------
select e.name as event, mi.name as item, mi.category
from public.menu_items mi
join public.events e on e.id = mi.event_id
where not exists (
  select 1 from public.event_orders o
  where o.event_id = mi.event_id and o.item_summary->>'name' = mi.name
)
order by e.name, mi.category, mi.sort_order;
