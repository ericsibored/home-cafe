create table if not exists beli_rankings (
  id uuid default gen_random_uuid() primary key,
  player_name text not null,
  item_id text not null,
  score float not null,
  wins int not null default 0,
  appearances int not null default 0,
  created_at timestamptz default now()
);

alter table beli_rankings enable row level security;

create policy "Anyone can read beli_rankings"
  on beli_rankings for select using (true);

create policy "Anyone can insert beli_rankings"
  on beli_rankings for insert with check (true);
