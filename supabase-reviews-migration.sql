-- Run this in your Supabase SQL editor (https://supabase.com/dashboard → SQL Editor)
-- Creates the reviews table needed for the review system.

create table if not exists public.reviews (
  id           uuid primary key default gen_random_uuid(),
  reviewer_name text not null,
  rating        int  not null check (rating between 1 and 5),
  comment       text,
  created_at    timestamptz not null default now()
);

-- Allow anonymous reads (so the modal can fetch reviews without auth)
alter table public.reviews enable row level security;

create policy "Anyone can read reviews"
  on public.reviews for select
  using (true);

create policy "Anyone can insert reviews"
  on public.reviews for insert
  with check (true);
