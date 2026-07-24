-- Permite insertar puntajes desde el cliente anon (fin de partida).
-- Ejecutar en Supabase SQL Editor.

alter table public.puntajes enable row level security;

drop policy if exists "public can insert puntajes" on public.puntajes;
create policy "public can insert puntajes"
on public.puntajes
for insert
to anon, authenticated
with check (true);

drop policy if exists "public can read puntajes" on public.puntajes;
create policy "public can read puntajes"
on public.puntajes
for select
to anon, authenticated
using (true);
