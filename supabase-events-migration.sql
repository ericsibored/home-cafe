-- ============================================================================
-- Events migration  (Phase 0 — freeze & archive the existing event)
-- Run this in your Supabase SQL editor (Dashboard -> SQL Editor).
-- Safe to re-run: uses IF NOT EXISTS / ON CONFLICT guards.
-- ============================================================================

-- 1. Events table --------------------------------------------------------------
create table if not exists public.events (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  date          date not null,
  description   text,
  is_active     boolean not null default false,
  menu_snapshot jsonb,                 -- verbatim raw record of the menu as served
  created_at    timestamptz not null default now()
);

-- At most one active event at a time (homepage reads the active one).
create unique index if not exists events_single_active
  on public.events (is_active) where is_active = true;

-- Fast reverse-chronological archive listing.
create index if not exists events_date_desc_idx on public.events (date desc);

-- 2. Row Level Security --------------------------------------------------------
alter table public.events enable row level security;

-- Anyone (anon) may read events (menus are public).
do $$ begin
  create policy "Anyone can read events" on public.events
    for select using (true);
exception when duplicate_object then null; end $$;

-- Only authenticated (the host) may write.
do $$ begin
  create policy "Authenticated can insert events" on public.events
    for insert to authenticated with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Authenticated can update events" on public.events
    for update to authenticated using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Authenticated can delete events" on public.events
    for delete to authenticated using (true);
exception when duplicate_object then null; end $$;

-- 3. Archive the one event already run -----------------------------------------
--    Lazy Orchard Vol. 1 — the debut pop-up (June 13, 2026).
--    menu_snapshot is the verbatim capture of src/lib/menu.ts at archive time.
insert into public.events (slug, name, date, description, is_active, menu_snapshot)
values (
  'vol-1',
  'Lazy Orchard Vol. 1',
  '2026-06-13',
  'The debut pop-up — Asian-inspired lattes & pastries',
  false,
  '{"items":[{"id":"banana-milk-coffee","name":"Banana Milk Coffee Latte","description":"Espresso over 바나나맛 우유, made with real banana","price":8.5,"category":"Drinks","emoji":"🍌","calories":180,"allergens":["dairy","soy"],"ingredients":["espresso","banana milk","banana"],"tempOptions":["iced"],"milkOptions":["Banana Milk"],"image":"/menu/banana-latte.jpeg"},{"id":"hojicha-persimmon","name":"Hojicha Persimmon Latte","description":"Hojicha (roasted matcha) over persimmon compote","price":8.5,"category":"Drinks","emoji":"🍂","calories":150,"allergens":["soy","dairy"],"ingredients":["hojicha","milk","persimmon"],"tempOptions":["iced"],"milkOptions":["Fairlife","Oat Milk"],"image":"/menu/hojicha-persimmon.jpeg"},{"id":"matcha-yuzuade","name":"Yuzuade","description":"Yuzuco Yuzu Juice, sugar, and water with optional shot of matcha. Bright, tart and refreshing.","price":8.5,"category":"Drinks","emoji":"🍋","calories":80,"allergens":[],"ingredients":["ceremonial matcha","yuzu juice","sparkling water","honey"],"tempOptions":["iced"],"image":"/menu/yuzuade.jpg","addOns":["matcha"]},{"id":"lychee-matcha","name":"Matcha Latte w/ Lychee Whipped Cream","description":"Smooth ceremonial matcha latte topped with airy lychee whipped cream","price":8.5,"category":"Drinks","emoji":"🌸","calories":170,"allergens":["soy","dairy"],"ingredients":["ceremonial matcha","oat milk","heavy cream","lychee juice"],"tempOptions":["hot","iced"],"milkOptions":["Fairlife","Oat Milk"],"image":"/menu/lychee-matcha.JPG","imageTransform":"translateY(-7%)"},{"id":"coffee-latte","name":"Coffee Latte","description":"Hot latte with option of adding emulsified strawberry syrup","price":4,"category":"Drinks","emoji":"☕","calories":140,"allergens":["dairy","soy"],"ingredients":["espresso","milk","strawberry"],"tempOptions":["hot"],"milkOptions":["Fairlife","Oat Milk"],"image":"/menu/coffee-latte.jpeg","imagePosition":"center 50%","addOns":["strawberry"]},{"id":"scallion-pancake-croissant","name":"Scallion Pancake Pastry Rolls","description":"Flaky puff pastry layered with scallions, sesame oil, and white pepper powder","price":6.5,"category":"Food","emoji":"🥐","calories":320,"allergens":["gluten","eggs","dairy"],"ingredients":["all-purpose flour","butter","eggs","scallions","sesame oil","salt"],"image":"/menu/green-onion-crossinat.JPG","imageTransform":"translateY(-12%)"},{"id":"jasmine-grape-cake","name":"Jasmine Green Grape Cream Cake","description":"Vanilla & jasmine tea sponge, layered with jasmine tea-infused custard and green grapes; chantilly cream exterior","price":6.5,"category":"Food","emoji":"🍰","calories":280,"allergens":["gluten","eggs","dairy"],"ingredients":["egg","neutral oil","cake flour","jasmine tea","heavy cream","vanilla bean","green grape"],"image":"/menu/grape-cake.jpeg"},{"id":"strawberry-earl-grey-cookies","name":"Strawberry & Earl Grey Cookies","description":"Neapolitan-style cookie with tri-flavor of: vanilla bean, strawberry, and black tea (mix of earl and victoria grey)","price":2.5,"category":"Food","emoji":"🍓","calories":140,"allergens":["gluten","dairy","eggs"],"ingredients":["butter","flour","egg","sugar","strawberry","black tea","dehydrated strawberry"],"image":"/menu/strawberry-earlgrey.jpeg","imagePosition":"center 60%"},{"id":"black-sesame-coconut-cookies","name":"Susuwatari Cookies","description":"Crispy coconut flake cookies with a rich sweetened black sesame paste — dark, nutty, and a little magical.","price":2.5,"category":"Food","emoji":"🍪","calories":160,"allergens":["gluten","tree nuts"],"ingredients":["black sesame paste","coconut flakes","butter","flour","sugar","vanilla"],"image":"/menu/black-sesame-cookie.JPG","imageTransform":"translateY(-15%)"}]}'::jsonb
)
on conflict (slug) do nothing;
