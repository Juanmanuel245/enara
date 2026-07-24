import localEnemigosCatalog from "@/data/enemigos.json";

export type EnemigoRow = {
  id: number | string;
  nombre: string | null;
  nivel: number | string | null;
  drop_bonus: number | string | null;
  imagen: string | null;
  vida: number | string | null;
  ataque: number | string | null;
  defensa: number | string | null;
  bloqueo: number | string | null;
  esquiva: number | string | null;
  experiencia: number | string | null;
  reputacion: number | string | null;
};

export type Enemigo = {
  id: string;
  nombre: string;
  nivel: number;
  drop_bonus: number;
  imagen: string;
  vida: number;
  ataque: number;
  defensa: number;
  bloqueo: number;
  esquiva: number;
  experiencia: number;
  reputacion: number;
};

export type DayStage3EncounterChoice = "defend" | "cave" | "dungeon";

export const ENEMIGO_SELECT_COLUMNS =
  "id, nombre, nivel, drop_bonus, imagen, vida, ataque, defensa, bloqueo, esquiva, experiencia, reputacion";

const ENEMIGOS_IMAGE_BASE = "/enemigos";

/** Completa la ruta publica de imagen cuando el catalogo solo trae el nombre del archivo. */
export const resolveEnemigoImagen = (imagen: string | null | undefined): string => {
  const value = typeof imagen === "string" ? imagen.trim() : "";
  if (!value) {
    return "";
  }

  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
    return value;
  }

  let path = value.replace(/^public\//, "");
  if (!path.startsWith("/")) {
    path = path.startsWith("enemigos/") ? `/${path}` : `${ENEMIGOS_IMAGE_BASE}/${path}`;
  }

  return path;
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const toNumber = (value: unknown, fallback = 0): number => {
  if (isFiniteNumber(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
};

export const normalizeEnemigo = (raw: unknown): Enemigo | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const item = raw as Record<string, unknown>;
  const idValue = toNumber(item.id, NaN);
  if (!Number.isFinite(idValue)) {
    return null;
  }

  const nombre = typeof item.nombre === "string" ? item.nombre.trim() : "";
  if (!nombre) {
    return null;
  }

  const imagen = resolveEnemigoImagen(
    typeof item.imagen === "string" && item.imagen.trim().length > 0 ? item.imagen : null
  );

  return {
    id: String(Math.round(idValue)),
    nombre,
    nivel: Math.max(1, Math.round(toNumber(item.nivel, 1))),
    drop_bonus: Math.max(0, toNumber(item.drop_bonus, 0)),
    imagen,
    vida: Math.max(1, Math.round(toNumber(item.vida, 1))),
    ataque: Math.max(0, Math.round(toNumber(item.ataque, 0))),
    defensa: Math.max(0, Math.round(toNumber(item.defensa, 0))),
    bloqueo: Math.max(0, Math.round(toNumber(item.bloqueo, 0))),
    esquiva: Math.max(0, Math.round(toNumber(item.esquiva, 0))),
    experiencia: Math.max(0, Math.round(toNumber(item.experiencia, 0))),
    reputacion: Math.max(0, Math.round(toNumber(item.reputacion, 0)))
  };
};

export const mapEnemigoRowToJson = (row: EnemigoRow): Enemigo | null => {
  const idValue = toNumber(row.id, NaN);
  if (!Number.isFinite(idValue)) {
    return null;
  }

  const nombre = typeof row.nombre === "string" ? row.nombre.trim() : "";
  if (!nombre) {
    return null;
  }

  const imagen = resolveEnemigoImagen(row.imagen);

  return {
    id: String(Math.round(idValue)),
    nombre,
    nivel: Math.max(1, Math.round(toNumber(row.nivel, 1))),
    drop_bonus: Math.max(0, toNumber(row.drop_bonus, 0)),
    imagen,
    vida: Math.max(1, Math.round(toNumber(row.vida, 1))),
    ataque: Math.max(0, Math.round(toNumber(row.ataque, 0))),
    defensa: Math.max(0, Math.round(toNumber(row.defensa, 0))),
    bloqueo: Math.max(0, Math.round(toNumber(row.bloqueo, 0))),
    esquiva: Math.max(0, Math.round(toNumber(row.esquiva, 0))),
    experiencia: Math.max(0, Math.round(toNumber(row.experiencia, 0))),
    reputacion: Math.max(0, Math.round(toNumber(row.reputacion, 0)))
  };
};

export const getLocalEnemigos = (): Enemigo[] =>
  (localEnemigosCatalog as unknown[]).map(normalizeEnemigo).filter((enemigo): enemigo is Enemigo => enemigo !== null);

const getMaxEnemyLevelForChoice = (heroNivel: number, choice: DayStage3EncounterChoice): number => {
  switch (choice) {
    case "defend":
      return heroNivel;
    case "cave":
      return heroNivel + 1;
    case "dungeon":
      return heroNivel + 2;
  }
};

export const filterEnemigosForEncounter = (
  enemigos: Enemigo[],
  heroNivel: number,
  choice: DayStage3EncounterChoice
): Enemigo[] => {
  const maxLevel = getMaxEnemyLevelForChoice(heroNivel, choice);
  return enemigos.filter((enemigo) => enemigo.nivel <= maxLevel);
};

export const pickRandomEnemigoForEncounter = (
  enemigos: Enemigo[],
  heroNivel: number,
  choice: DayStage3EncounterChoice
): Enemigo | null => {
  const eligible = filterEnemigosForEncounter(enemigos, heroNivel, choice);
  if (eligible.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * eligible.length);
  return eligible[index] ?? null;
};

export const getEncounterChoiceLabel = (choice: DayStage3EncounterChoice): string => {
  switch (choice) {
    case "defend":
      return "Defender los caminos";
    case "cave":
      return "Ingresar a cueva";
    case "dungeon":
      return "Ingresar a Mazmorra";
  }
};
