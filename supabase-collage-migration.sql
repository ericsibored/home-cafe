-- Collage feature migration
-- Run this in the Supabase SQL Editor for the home-cafe project

-- 1. Create the collage_entries table
create table if not exists collage_entries (
  id uuid default gen_random_uuid() primary key,
  photo_url text not null,
  note text,
  guest_name text not null,
  created_at timestamptz default now()
);

-- 2. Enable Row Level Security
alter table collage_entries enable row level security;

-- 3. RLS policies
create policy "Anyone can read collage_entries"
  on collage_entries for select
  using (true);

create policy "Anyone can insert collage_entries"
  on collage_entries for insert
  with check (true);

-- 4. Storage bucket (run this after creating the bucket in the Supabase dashboard,
--    OR you can create it programmatically — the bucket name must be: collage-photos)
-- NOTE: Create the bucket manually in Storage → New bucket → name: collage-photos → Public: ON
