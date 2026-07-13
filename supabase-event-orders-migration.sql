-- ============================================================================
-- Event orders migration  (Phase 2 — lightweight order submission)
-- Run this in your Supabase SQL editor (Dashboard -> SQL Editor).
-- Safe to re-run: IF NOT EXISTS / guarded policies.
--
-- NOTE: A separate `orders` table already exists for the /classic app (with a
-- reviews FK). This new event-based ordering uses its own `event_orders` table
-- so the two systems stay independent.
-- ============================================================================

create table if not exists public.event_orders (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events (id) on delete cascade,
  item_type    text not null check (item_type in ('specialty', 'builder')),
  item_summary jsonb not null,   -- specialty: {name,temp?}; builder: {base,syrup,modifier?}
  label        text not null,    -- human-readable summary for the admin feed
  guest_name   text not null,
  status       text not null default 'pending' check (status in ('pending', 'made')),
  created_at   timestamptz not null default now()
);

create index if not exists event_orders_event_status_idx
  on public.event_orders (event_id, status, created_at);

-- Row Level Security ----------------------------------------------------------
-- anon may INSERT orders only (never read them — the table holds guest names).
-- authenticated (the host) may do everything.
alter table public.event_orders enable row level security;

grant insert on public.event_orders to anon;
grant select, insert, update, delete on public.event_orders to authenticated;

do $$ begin
  create policy "Anon can place orders" on public.event_orders
    for insert to anon with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Authenticated manage orders" on public.event_orders
    for all to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

-- Realtime — so the host's /admin order feed updates live -----------------------
do $$ begin
  alter publication supabase_realtime add table public.event_orders;
exception when duplicate_object then null; end $$;
