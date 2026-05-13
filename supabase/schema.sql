create table public.orders (
  id uuid default gen_random_uuid() primary key,
  customer_name text not null,
  items jsonb not null,
  total numeric(10, 2) not null,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'completed', 'cancelled')),
  note text,
  created_at timestamptz default now()
);

alter table public.orders enable row level security;

create policy "Allow all" on public.orders
  for all using (true) with check (true);

alter publication supabase_realtime add table public.orders;
