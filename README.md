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

## Integracion con Supabase (armas)

1. Copia `.env.example` a `.env.local` y completa:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. Crea la tabla `armas` (con columnas como `idarma`, `nombre`, `ataque`, `drop`, `rareza`, `tipo`, etc.).
3. Inicia la app (`npm run dev`).

En la primera carga del juego, se intenta leer `src/data/armas.json`. Si no existe, se descarga la tabla desde Supabase y se guarda localmente para evitar consultas constantes.