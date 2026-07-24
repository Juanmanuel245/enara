import type { HeroStats } from "@/lib/player";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import localItemCatalog from "@/data/items.json";

export type GameItem = {
  id: string;
  name: string;
  slot: string;
  rarity: string;
  cost: number;
  image?: string;
  effects: Partial<Record<keyof HeroStats, number>>;
  dropRatePercent: number;
  isDropping: boolean;
  isSelling: boolean;
  nivel: number;
};

/** @deprecated Usar GameItem */
export type WeaponItem = GameItem;

export type ItemRow = {
  id: number;
  nombre: string;
  valor: number;
  drop: number;
  is_dropping: boolean;
  is_selling: boolean;
  imagen: string | null;
  slot: string;
  ataque: number;
  defensa: number;
  agilidad: number;
  salud: number;
  rareza: string;
  tipo: string;
  nivel: number;
};

export const ITEM_SELECT_COLUMNS =
  "id, nombre, valor, drop, is_dropping, is_selling, imagen, slot, ataque, defensa, agilidad, salud, rareza, tipo, nivel";

/** @deprecated Usar ITEM_SELECT_COLUMNS */
export const ARMA_SELECT_COLUMNS = ITEM_SELECT_COLUMNS;

export const CONSUMABLE_SLOT = "consumible";

export const DROP_POOL_SIZE = 100;
/** Porcentaje de slots vacios en el pool de drop (0-100). Ajusta segun necesites. */
export const DROP_EMPTY_PERCENT = 10;
/** Drop maximo permitido por item (0-100). */
export const DROP_RATE_MAX_PERCENT = 50;
/** Niveles por debajo del enemigo incluidos en el pool de drop. */
export const DROP_LEVEL_MIN_OFFSET = 2;
/** Niveles por encima del enemigo incluidos en el pool de drop. */
export const DROP_LEVEL_MAX_OFFSET = 1;

const allowedEffectKeys: (keyof HeroStats)[] = [
  "fuerza",
  "carisma",
  "agilidad",
  "suerte",
  "reputacion",
  "vida",
  "dano",
  "defensa"
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizeEffects = (effects: unknown): GameItem["effects"] => {
  if (!effects || typeof effects !== "object") {
    return {};
  }

  const source = effects as Record<string, unknown>;
  const normalized: GameItem["effects"] = {};

  for (const key of allowedEffectKeys) {
    const raw = source[key];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      normalized[key] = raw;
    }
  }

  return normalized;
};

export const normalizeItemSlot = (slot: string): string => {
  const trimmed = slot.trim();
  if (trimmed === "mainHand") {
    return "mano_principal";
  }
  if (trimmed === "offHand") {
    return "mano_secundaria";
  }
  return trimmed.toLowerCase();
};

export const isConsumableItem = (item: Pick<GameItem, "slot">) =>
  normalizeItemSlot(item.slot) === CONSUMABLE_SLOT;

export const normalizeGameItem = (raw: unknown): GameItem | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const item = raw as Partial<GameItem & { is_dropping?: boolean; is_selling?: boolean; drop?: number }>;
  if (typeof item.id !== "string" || typeof item.name !== "string" || typeof item.slot !== "string") {
    return null;
  }

  const slot = normalizeItemSlot(item.slot);
  const dropRatePercent =
    typeof item.dropRatePercent === "number"
      ? item.dropRatePercent
      : typeof item.drop === "number"
        ? item.drop
        : null;
  const isDropping =
    typeof item.isDropping === "boolean"
      ? item.isDropping
      : typeof item.is_dropping === "boolean"
        ? item.is_dropping
        : true;
  const isSelling =
    typeof item.isSelling === "boolean"
      ? item.isSelling
      : typeof item.is_selling === "boolean"
        ? item.is_selling
        : false;
  const nivel = typeof item.nivel === "number" && Number.isFinite(item.nivel) ? Math.max(1, Math.round(item.nivel)) : 1;

  if (
    typeof item.rarity !== "string" ||
    typeof item.cost !== "number" ||
    dropRatePercent === null
  ) {
    return null;
  }

  return {
    id: item.id,
    name: item.name,
    slot,
    rarity: item.rarity,
    cost: Math.max(0, Math.round(item.cost)),
    image: typeof item.image === "string" && item.image.trim().length > 0 ? item.image : undefined,
    effects: normalizeEffects(item.effects),
    dropRatePercent: clamp(dropRatePercent, 0, DROP_RATE_MAX_PERCENT),
    isDropping,
    isSelling,
    nivel
  };
};

/** @deprecated Usar normalizeGameItem */
export const normalizeWeaponItem = normalizeGameItem;

const buildItemEffects = (row: ItemRow): GameItem["effects"] => {
  const effects: GameItem["effects"] = {};

  if (row.ataque) {
    effects.dano = row.ataque;
  }
  if (row.defensa) {
    effects.defensa = row.defensa;
  }
  if (row.agilidad) {
    effects.agilidad = row.agilidad;
  }
  if (row.salud) {
    effects.vida = row.salud;
  }

  return effects;
};

export const mapItemRowToGameItem = (row: ItemRow): GameItem | null =>
  normalizeGameItem({
    id: String(row.id),
    name: row.nombre,
    slot: normalizeItemSlot(row.slot),
    rarity: row.rareza,
    cost: row.valor,
    image: row.imagen ?? undefined,
    effects: buildItemEffects(row),
    dropRatePercent: row.drop,
    isDropping: row.is_dropping,
    isSelling: row.is_selling,
    nivel: row.nivel
  });

/** @deprecated Usar mapItemRowToGameItem */
export const mapArmaRowToWeaponItem = mapItemRowToGameItem;

export const mapItemRowToJson = (row: ItemRow) => {
  const item = mapItemRowToGameItem(row);
  if (!item) {
    return null;
  }

  return {
    id: item.id,
    name: item.name,
    slot: item.slot,
    rarity: item.rarity,
    cost: item.cost,
    image: item.image,
    effects: item.effects,
    dropRatePercent: item.dropRatePercent,
    isDropping: item.isDropping,
    isSelling: item.isSelling,
    nivel: item.nivel
  };
};

/** @deprecated Usar mapItemRowToJson */
export const mapArmaRowToWeaponJson = mapItemRowToJson;

export const getLocalItems = (): GameItem[] =>
  (localItemCatalog as unknown[]).map(normalizeGameItem).filter((item): item is GameItem => item !== null);

/** @deprecated Usar getLocalItems */
export const getLocalWeaponItems = getLocalItems;

export const fetchItems = async (): Promise<GameItem[]> => {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return getLocalItems();
  }

  const { data, error } = await supabase
    .from("items")
    .select(ITEM_SELECT_COLUMNS)
    .order("id", { ascending: true });

  if (error || !data) {
    return getLocalItems();
  }

  const normalized = (data as ItemRow[])
    .map(mapItemRowToGameItem)
    .filter((item): item is GameItem => item !== null);

  return normalized.length > 0 ? normalized : getLocalItems();
};

/** @deprecated Usar fetchItems */
export const fetchWeaponItems = fetchItems;

export const warmupItemCatalog = async (): Promise<void> => {
  try {
    await fetchItems();
  } catch {
    // No bloqueamos la creacion de personaje si falla la precarga.
  }
};

/** @deprecated Usar warmupItemCatalog */
export const warmupWeaponCatalog = warmupItemCatalog;

export const getDropEligibleItems = (
  items: GameItem[],
  enemy: { nivel: number }
): GameItem[] => {
  const minLevel = Math.max(1, enemy.nivel - DROP_LEVEL_MIN_OFFSET);
  const maxLevel = enemy.nivel + DROP_LEVEL_MAX_OFFSET;

  return items.filter(
    (item) => item.isDropping && item.nivel >= minLevel && item.nivel <= maxLevel
  );
};

export const buildDropPool = (
  items: GameItem[],
  enemy: { nivel: number; drop_bonus: number }
): (GameItem | null)[] => {
  const eligible = getDropEligibleItems(items, enemy);
  if (eligible.length === 0) {
    return Array.from({ length: DROP_POOL_SIZE }, () => null);
  }

  const weights = eligible.map((item) => item.dropRatePercent * enemy.drop_bonus);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (totalWeight <= 0) {
    return Array.from({ length: DROP_POOL_SIZE }, () => null);
  }

  const emptyCount = Math.round(DROP_POOL_SIZE * (clamp(DROP_EMPTY_PERCENT, 0, 100) / 100));
  const itemSlotCount = DROP_POOL_SIZE - emptyCount;
  const pool: (GameItem | null)[] = Array.from({ length: emptyCount }, () => null);

  let assigned = 0;
  eligible.forEach((item, index) => {
    const isLast = index === eligible.length - 1;
    const count = isLast
      ? Math.max(0, itemSlotCount - assigned)
      : Math.max(0, Math.round((weights[index] / totalWeight) * itemSlotCount));
    assigned += count;
    for (let slot = 0; slot < count; slot += 1) {
      pool.push(item);
    }
  });

  while (pool.length < DROP_POOL_SIZE) {
    pool.push(null);
  }

  return pool.slice(0, DROP_POOL_SIZE);
};

export const rollDroppedItem = (
  items: GameItem[],
  enemy: { nivel: number; drop_bonus: number }
): GameItem | null => {
  const pool = buildDropPool(items, enemy);
  if (pool.length === 0) {
    return null;
  }

  const picked = pool[Math.floor(Math.random() * pool.length)];
  return picked ?? null;
};

export const findItemById = (items: GameItem[], itemId: string | null | undefined) =>
  itemId ? items.find((item) => item.id === itemId) ?? null : null;

export const sumItemEffects = (items: Pick<GameItem, "effects">[]): Partial<Record<keyof HeroStats, number>> => {
  const totals: Partial<Record<keyof HeroStats, number>> = {};

  items.forEach((item) => {
    (Object.keys(item.effects) as (keyof HeroStats)[]).forEach((key) => {
      const value = item.effects[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        totals[key] = (totals[key] ?? 0) + value;
      }
    });
  });

  return totals;
};
