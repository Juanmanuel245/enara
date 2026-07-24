# Futrol

Juego RPG narrativo en el que un personaje comun busca convertirse en leyenda.

## Stack

- Next.js (App Router)
- Tailwind CSS
- shadcn/ui

## Inicio rapido

```bash
npm install
npm run dev
```

## Integracion con Supabase (items)

1. Copia `.env.example` a `.env.local` y completa:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. Ejecuta la migracion en Supabase SQL Editor:
   - `supabase/migrate_armas_to_items.sql` (renombra `armas` -> `items`, `idarma` -> `id`, agrega `nivel`)
   - `supabase/rls_catalogos.sql` (policies de lectura anon)
3. Regenera catalogos locales con `GET /api/regenerar-catalogos` o inicia la app (`npm run dev`).

En la primera carga del juego, se intenta leer `src/data/items.json`. Si no existe, se descarga la tabla `items` desde Supabase y se guarda localmente para evitar consultas constantes.

### Columnas clave de `items`

- `id`, `nombre`, `slot`, `nivel`, `drop`, `is_dropping`
- Stats: `ataque`, `defensa`, `agilidad`, `salud`
- Meta: `valor`, `rareza`, `tipo`, `imagen`, `is_selling`

### Drops de combate

Al derrotar un enemigo, el juego filtra items con `is_dropping = true` y `nivel <= enemigo.nivel`, pondera por `drop * drop_bonus`, reserva 30% de espacios vacios y elige uno al azar. El item se guarda automaticamente en el inventario del heroe.
