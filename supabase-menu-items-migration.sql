-- ============================================================================
-- Menu items & builder options migration  (Phase 1 — restructure menus)
-- Run this in your Supabase SQL editor (Dashboard -> SQL Editor).
-- Safe to re-run: uses IF NOT EXISTS / guarded policies / idempotent backfill.
-- Requires the events table (supabase-events-migration.sql) to exist first.
-- ============================================================================

-- 1. menu_items — the hero "Specialties" for an event ---------------------------
--    Core columns match the spec (name, description, ingredients, sold_out);
--    `details` jsonb carries optional presentation (price, image, emoji,
--    calories, allergens, temp/milk options, add-ons) so a single rendering
--    path can stay rich without a wide table.
create table if not exists public.menu_items (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  name        text not null,
  description text,
  ingredients text[],
  sold_out    boolean not null default false,
  category    text,                         -- optional grouping (e.g. Drinks / Food)
  sort_order  int not null default 0,
  details     jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists menu_items_event_idx
  on public.menu_items (event_id, sort_order);

-- 2. builder_options — the "Build Your Own" matrix ------------------------------
--    The picker is built ONLY from these rows: choose base -> syrup -> optional
--    modifier. Unavailable rows stay visible but disabled.
create table if not exists public.builder_options (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  category    text not null check (category in ('base', 'syrup', 'modifier')),
  name        text not null,
  available   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists builder_options_event_idx
  on public.builder_options (event_id, category, sort_order);

-- 3. Row Level Security ---------------------------------------------------------
--    anon may read (public menus); only authenticated (the host) may write.
alter table public.menu_items      enable row level security;
alter table public.builder_options enable row level security;

do $$ begin
  create policy "Anyone can read menu_items" on public.menu_items
    for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Authenticated can write menu_items" on public.menu_items
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Anyone can read builder_options" on public.builder_options
    for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Authenticated can write builder_options" on public.builder_options
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

-- 4. Realtime — so the host can toggle sold_out / available mid-event -----------
do $$ begin
  alter publication supabase_realtime add table public.menu_items;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.builder_options;
exception when duplicate_object then null; end $$;

-- 5. Backfill Lazy Orchard Vol. 1 into menu_items ------------------------------
--    Verbatim from the (untouched) menu_snapshot; no builder_options rows since
--    that event predates the builder. Idempotent: skips if items already exist.
insert into public.menu_items (event_id, name, description, ingredients, sold_out, category, sort_order, details)
select
  e.id,
  item->>'name',
  item->>'description',
  case when item ? 'ingredients'
       then array(select jsonb_array_elements_text(item->'ingredients'))
       else null end,
  false,
  item->>'category',
  (ord - 1)::int,
  -- details = the remaining presentational keys of the original item
  (item - 'name' - 'description' - 'ingredients' - 'category')
from public.events e
cross join lateral jsonb_array_elements(e.menu_snapshot->'items') with ordinality as t(item, ord)
where e.slug = 'vol-1'
  and not exists (select 1 from public.menu_items mi where mi.event_id = e.id);
