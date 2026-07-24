-- Permite lectura publica de catalogos usados por el juego (rol anon).
-- Ejecutar en Supabase SQL Editor si la sync devuelve arrays vacios.

alter table public.items enable row level security;
alter table public.destino_inicial enable row level security;
alter table public.misiones enable row level security;
alter table public.enemigos enable row level security;

drop policy if exists "public can read armas" on public.armas;
drop policy if exists "public can read items" on public.items;
create policy "public can read items"
on public.items
for select
to anon, authenticated
using (true);

drop policy if exists "public can read destino_inicial" on public.destino_inicial;
create policy "public can read destino_inicial"
on public.destino_inicial
for select
to anon, authenticated
using (true);

drop policy if exists "public can read misiones" on public.misiones;
create policy "public can read misiones"
on public.misiones
for select
to anon, authenticated
using (true);

drop policy if exists "public can read enemigos" on public.enemigos;
create policy "public can read enemigos"
on public.enemigos
for select
to anon, authenticated
using (true);
