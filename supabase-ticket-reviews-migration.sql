-- Ticket-based review system migration
-- Run this in the Supabase SQL editor

-- Add ticket_code to existing orders table
-- (The orders table already exists with customer_name, items, total, note, status columns)
alter table orders add column if not exists ticket_code char(4) unique;

-- Enable RLS (safe to run even if already enabled)
alter table orders enable row level security;

-- RLS policies (wrapped in DO blocks to skip if already exist)
do $$ begin
  create policy "Anyone can read orders" on orders for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Anyone can insert orders" on orders for insert with check (true);
exception when duplicate_object then null; end $$;

-- Add ticket_code and item_id to reviews table
alter table reviews add column if not exists ticket_code char(4) references orders(ticket_code);
alter table reviews add column if not exists item_id text; -- matches MenuItem.id
