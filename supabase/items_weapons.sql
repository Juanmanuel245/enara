create table if not exists public.items_weapons (
  id text primary key,
  name text not null,
  slot text not null check (slot in ('mainHand', 'offHand')),
  rarity text not null,
  cost integer not null default 0 check (cost >= 0),
  image text,
  effects jsonb not null default '{}'::jsonb,
  drop_rate_percent numeric(5,2) not null default 0 check (drop_rate_percent >= 0 and drop_rate_percent <= 100),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists items_weapons_active_idx on public.items_weapons (is_active);

create or replace function public.set_updated_at_items_weapons()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_items_weapons_updated_at on public.items_weapons;

create trigger trg_items_weapons_updated_at
before update on public.items_weapons
for each row
execute function public.set_updated_at_items_weapons();

alter table public.items_weapons enable row level security;

drop policy if exists "public can read active weapons" on public.items_weapons;
create policy "public can read active weapons"
on public.items_weapons
for select
to anon, authenticated
using (is_active = true);

insert into public.items_weapons (
  id,
  name,
  slot,
  rarity,
  cost,
  image,
  effects,
  drop_rate_percent,
  is_active
)
values
  ('mw_axe_01', 'Hacha simple', 'mainHand', 'comun', 8, '/items/armas/hachas/01_hacha_simple.png', '{"dano":1}'::jsonb, 22, true),
  ('mw_axe_02', 'Hacha oxidada', 'mainHand', 'comun', 10, '/items/armas/hachas/02_hacha_oxidada.png', '{"dano":2,"fuerza":1}'::jsonb, 18, true),
  ('mw_axe_03', 'Hacha usada', 'mainHand', 'comun', 12, '/items/armas/hachas/03_hacha_usada.png', '{"dano":2,"defensa":1}'::jsonb, 16, true),
  ('mw_axe_04', 'Hacha hierro', 'mainHand', 'raro', 15, '/items/armas/hachas/04_hacha_hierro.png', '{"dano":3,"fuerza":1}'::jsonb, 12, true),
  ('mw_axe_05', 'Hacha barbara', 'mainHand', 'raro', 18, '/items/armas/hachas/05_hacha_barbara.png', '{"dano":3,"fuerza":2,"agilidad":-1}'::jsonb, 10, true),
  ('mw_axe_06', 'Hacha maldita', 'mainHand', 'epico', 24, '/items/armas/hachas/06_hacha_maldita.png', '{"dano":4,"fuerza":2,"vida":-3}'::jsonb, 2, true),
  ('mw_axe_07', 'Hacha de fuego', 'mainHand', 'epico', 28, '/items/armas/hachas/07_hacha_de_fuego.png', '{"dano":5,"fuerza":1}'::jsonb, 2, true),
  ('mw_axe_08', 'Hacha de hielo', 'mainHand', 'epico', 30, '/items/armas/hachas/08_hacha_de_hielo.png', '{"dano":5,"defensa":2}'::jsonb, 2, true),
  ('mw_axe_09', 'Hacha arcana', 'mainHand', 'legendario', 38, '/items/armas/hachas/09_hacha_arcana.png', '{"dano":6,"fuerza":2,"carisma":1}'::jsonb, 2, true)
on conflict (id) do update
set
  name = excluded.name,
  slot = excluded.slot,
  rarity = excluded.rarity,
  cost = excluded.cost,
  image = excluded.image,
  effects = excluded.effects,
  drop_rate_percent = excluded.drop_rate_percent,
  is_active = excluded.is_active,
  updated_at = now();
