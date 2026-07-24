-- Migracion: armas -> items, idarma -> id, columna nivel
-- Ejecutar en Supabase SQL Editor antes de regenerar catalogos.

alter table if exists public.armas rename to items;

alter table if exists public.items rename column idarma to id;

alter table if exists public.items
  add column if not exists nivel integer not null default 1;

-- Backfill opcional por rareza (ajustar segun tu catalogo).
update public.items
set nivel = case
  when lower(rareza) like '%legend%' then 10
  when lower(rareza) like '%rara%' then 5
  when lower(rareza) like '%poco%' then 3
  else 1
end
where nivel is null or nivel = 1;
