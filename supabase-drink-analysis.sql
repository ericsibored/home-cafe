-- ============================================================================
-- Coffee vs matcha vs everything else
--
-- Work through this top to bottom:
--   STEP 1  find the junk rows
--   STEP 2  exclude them (non-destructive) or delete them (permanent)
--   STEP 3  run the comparison
--
-- Reminder: event_orders holds one row per cart line, and quantity is absent
-- when it is 1 — so units always need
--   coalesce((item_summary->>'quantity')::int, 1)
-- ============================================================================


-- ─── STEP 1 · Find test data ────────────────────────────────────────────────

-- 1a. Every guest name, with when they ordered. Eyeball this for test entries.
select
  o.guest_name,
  count(*)                                     as line_items,
  count(distinct (o.guest_name, o.created_at)) as tickets,
  min(o.created_at)                            as first_order,
  max(o.created_at)                            as last_order
from public.event_orders o
group by o.guest_name
order by min(o.created_at);

-- 1b. Strong signal: orders placed on a different day than the event itself.
--     Testing almost always happens before the event date.
select o.id, e.name as event, e.date as event_date,
       o.created_at, o.guest_name, o.label
from public.event_orders o
join public.events e on e.id = o.event_id
where o.created_at::date <> e.date
order by o.created_at;

-- 1c. Obvious placeholder names (widen the list as needed).
select o.id, o.guest_name, o.label, o.created_at
from public.event_orders o
where o.guest_name ilike any (array['test%','%asdf%','abc%','aaa%','x','xx','me','sam test%'])
order by o.created_at;


-- ─── STEP 2 · Deal with them ────────────────────────────────────────────────
--
-- OPTION A (recommended) — leave the rows alone and exclude them at query time.
-- Nothing is lost, and you can adjust the list as you spot more. Every query in
-- STEP 3 already filters through the `clean` CTE below; just edit the two lists.
--
-- OPTION B (permanent) — actually delete. ALWAYS preview first:
--
--   select id, guest_name, label, created_at from public.event_orders
--   where guest_name in ('Test', 'asdf');
--
-- then, once the preview shows only rows you want gone:
--
--   delete from public.event_orders where guest_name in ('Test', 'asdf');
--
-- To rehearse a delete safely, wrap it and roll back:
--
--   begin;
--     delete from public.event_orders where guest_name in ('Test');
--     -- check the reported row count looks right
--   rollback;   -- swap to commit; only when you are sure


-- ─── STEP 3 · The comparison ────────────────────────────────────────────────
--
-- Classification rules:
--   * builder drinks  -> by their base (Matcha / Espresso)
--   * specialties     -> by name + the item's ingredients list
--   * matcha is checked before coffee, so a hypothetical dirty-matcha counts
--     as matcha
--
-- HOJICHA: "Hojicha Persimmon Latte" lands in `other`, because hojicha is
-- roasted green tea rather than matcha (its ingredients list says hojicha, not
-- matcha). If you would rather group it with matcha, add `or haystack like
-- '%hojicha%'` to the matcha branch below. Same idea for thai tea if you ever
-- want a dedicated tea bucket.

with clean as (
  select o.*
  from public.event_orders o
  where o.guest_name not in ('Test')          -- <-- test names to drop
    and o.id not in ('00000000-0000-0000-0000-000000000000'::uuid)  -- <-- one-off ids
),
classified as (
  select
    c.event_id,
    coalesce((c.item_summary->>'quantity')::int, 1) as qty,
    case
      when h.haystack like '%matcha%'  then 'matcha'
      when h.haystack like '%espresso%'
        or h.haystack like '%coffee%'  then 'coffee'
      else 'other'
    end as drink_type
  from clean c
  left join public.menu_items mi
    on mi.event_id = c.event_id and mi.name = c.item_summary->>'name'
  cross join lateral (
    select lower(concat_ws(' ',
      c.item_summary->>'name',      -- specialty name
      c.item_summary->>'base',      -- builder base
      array_to_string(mi.ingredients, ' ')
    )) as haystack
  ) h
)
-- 3a. Overall split
select
  drink_type,
  count(*)                                          as line_items,
  sum(qty)                                          as units,
  round(100.0 * sum(qty) / sum(sum(qty)) over (), 1) as pct_of_units
from classified
group by drink_type
order by units desc;


-- 3b. Same split, per event (rerun with the CTEs above if running standalone)
with clean as (
  select o.* from public.event_orders o
  where o.guest_name not in ('Test')
),
classified as (
  select
    c.event_id,
    coalesce((c.item_summary->>'quantity')::int, 1) as qty,
    case
      when h.haystack like '%matcha%'  then 'matcha'
      when h.haystack like '%espresso%'
        or h.haystack like '%coffee%'  then 'coffee'
      else 'other'
    end as drink_type
  from clean c
  left join public.menu_items mi
    on mi.event_id = c.event_id and mi.name = c.item_summary->>'name'
  cross join lateral (
    select lower(concat_ws(' ',
      c.item_summary->>'name', c.item_summary->>'base',
      array_to_string(mi.ingredients, ' '))) as haystack
  ) h
)
select
  e.name                                                       as event,
  sum(qty) filter (where drink_type = 'matcha')                as matcha,
  sum(qty) filter (where drink_type = 'coffee')                as coffee,
  sum(qty) filter (where drink_type = 'other')                 as other,
  sum(qty)                                                     as total,
  round(100.0 * sum(qty) filter (where drink_type = 'matcha')
        / nullif(sum(qty), 0), 1)                              as pct_matcha
from classified
join public.events e on e.id = classified.event_id
group by e.id, e.name, e.date
order by e.date;


-- 3c. Sanity check — see exactly how each drink got classified.
--     Run this before trusting the totals; it is how you catch a drink landing
--     in the wrong bucket.
select distinct
  coalesce(o.item_summary->>'name', concat('BUILD: ', o.item_summary->>'base')) as drink,
  o.item_type,
  case
    when h.haystack like '%matcha%'  then 'matcha'
    when h.haystack like '%espresso%' or h.haystack like '%coffee%' then 'coffee'
    else 'other'
  end as drink_type
from public.event_orders o
left join public.menu_items mi
  on mi.event_id = o.event_id and mi.name = o.item_summary->>'name'
cross join lateral (
  select lower(concat_ws(' ',
    o.item_summary->>'name', o.item_summary->>'base',
    array_to_string(mi.ingredients, ' '))) as haystack
) h
order by drink_type, drink;
