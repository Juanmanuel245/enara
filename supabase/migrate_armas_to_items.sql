-- Migracion: armas -> items, idarma -> id, columna nivel_minimo
-- Ejecutar en Supabase SQL Editor antes de regenerar catalogos.

alter table if exists public.armas rename to items;

alter table if exists public.items rename column idarma to id;

alter table if exists public.items
  add column if not exists nivel_minimo numeric null default 1;

alter table if exists public.items
  rename column nivel to nivel_minimo;

alter table if exists public.items
  add column if not exists ovr numeric null,
  add column if not exists is_crafting boolean null default false,
  add column if not exists nombre_archivo text null,
  add column if not exists tipo text null;

-- Backfill opcional por rareza (ajustar segun tu catalogo).
update public.items
set nivel_minimo = case
  when lower(rareza) like '%legend%' then 10
  when lower(rareza) like '%rara%' then 5
  when lower(rareza) like '%poco%' then 3
  else 1
end
where nivel_minimo is null or nivel_minimo = 1;
