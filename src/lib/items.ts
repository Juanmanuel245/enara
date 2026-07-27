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
  /** Slots de inventario extra que otorga una mochila equipada. */
  slots?: number;
  dropRatePercent: number;
  isDropping: boolean;
  isSelling: boolean;
  /** Nivel minimo del heroe para equipar el item. */
  nivel: number;
  tipo?: string;
  ovr?: number;
  isCrafting?: boolean;
  nombreArchivo?: string;
};

export type DropOutcome =
  | { kind: "none" }
  | { kind: "gold"; amount: number }
  | { kind: "item"; item: GameItem };

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
  tipo: string | null;
  ovr: number | null;
  nivel_minimo: number | null;
  is_crafting: boolean | null;
  nombre_archivo: string | null;
  /** Compatibilidad con esquemas viejos. */
  nivel?: number | null;
};

export const ITEM_SELECT_COLUMNS =
  "id, nombre, valor, drop, is_dropping, is_selling, imagen, slot, ataque, defensa, agilidad, salud, rareza, tipo, ovr, nivel_minimo, is_crafting, nombre_archivo";

const ITEMS_IMAGE_BASE = "/items";

/** Completa la ruta publica de imagen cuando el catalogo trae solo tipo/archivo. */
export const resolveItemImage = (image: string | null | undefined): string => {
  const value = typeof image === "string" ? image.trim() : "";
  if (!value) {
    return "";
  }

  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("data:")) {
    return value;
  }

  let path = value.replace(/^public\//, "");

  if (path.startsWith("/items/")) {
    path = path.slice("/items/".length);
  } else if (path.startsWith("/")) {
    return path;
  }

  if (path.startsWith("items/")) {
    return `/${path}`;
  }

  if (!path.includes("/")) {
    const folderByPattern: [string, string][] = [
      ["_hacha_", "hacha"],
      ["_espada_", "espada"],
      ["_daga_", "daga"],
      ["_lanza_", "lanza"],
      ["_maza_", "maza"],
      ["_orbe_", "orbe"],
      ["_escudo_", "escudo"],
      ["_cinturon_", "cinturon"],
      ["_casco_", "casco"],
      ["_pechera_", "pechera"],
      ["_pantalon_", "pantalon"],
      ["_bota_", "bota"],
      ["_guantes_", "guante"],
      ["_guante_", "guante"],
      ["_hombrera", "hombrera"],
      ["_hombreras", "hombrera"],
      ["_capa_", "capa"],
      ["_brazalete", "brazalete"]
    ];

    for (const [pattern, folder] of folderByPattern) {
      if (path.includes(pattern)) {
        path = `${folder}/${path}`;
        break;
      }
    }
  }

  return `${ITEMS_IMAGE_BASE}/${path}`;
};

/** @deprecated Usar ITEM_SELECT_COLUMNS */
export const ARMA_SELECT_COLUMNS = ITEM_SELECT_COLUMNS;

export const CONSUMABLE_SLOT = "consumible";
export const BACKPACK_ITEM_SLOT = "mochila";

export const DROP_POOL_SIZE = 100;
/** Porcentaje de slots vacios en el pool de drop (0-100). */
export const DROP_EMPTY_PERCENT = 25;
/** Porcentaje de slots de solo oro en el pool de drop (0-100). */
export const DROP_GOLD_ONLY_PERCENT = 15;
/** Oro fijo otorgado cuando cae el outcome de solo oro. */
export const DROP_GOLD_AMOUNT = 100;
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

export const isBackpackItem = (item: Pick<GameItem, "slot">) =>
  normalizeItemSlot(item.slot) === BACKPACK_ITEM_SLOT;

export const getBackpackSlots = (item: Pick<GameItem, "slots">) =>
  typeof item.slots === "number" && item.slots > 0 ? Math.round(item.slots) : 0;

export const normalizeGameItem = (raw: unknown): GameItem | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const item = raw as Partial<
    GameItem & {
      is_dropping?: boolean;
      is_selling?: boolean;
      drop?: number;
      nivel_minimo?: number;
      is_crafting?: boolean;
      nombre_archivo?: string;
    }
  >;
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
  const nivelRaw =
    typeof item.nivel === "number"
      ? item.nivel
      : typeof item.nivel_minimo === "number"
        ? item.nivel_minimo
        : 1;
  const nivel = Number.isFinite(nivelRaw) ? Math.max(1, Math.round(nivelRaw)) : 1;
  const slots =
    typeof item.slots === "number" && Number.isFinite(item.slots)
      ? Math.max(0, Math.round(item.slots))
      : undefined;
  const ovr = typeof item.ovr === "number" && Number.isFinite(item.ovr) ? Math.round(item.ovr) : undefined;
  const isCrafting =
    typeof item.isCrafting === "boolean"
      ? item.isCrafting
      : typeof item.is_crafting === "boolean"
        ? item.is_crafting
        : undefined;
  const nombreArchivo =
    typeof item.nombreArchivo === "string"
      ? item.nombreArchivo
      : typeof item.nombre_archivo === "string"
        ? item.nombre_archivo
        : undefined;

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
    image: typeof item.image === "string" && item.image.trim().length > 0 ? item.image.trim() : undefined,
    effects: normalizeEffects(item.effects),
    slots,
    dropRatePercent: clamp(dropRatePercent, 0, DROP_RATE_MAX_PERCENT),
    isDropping,
    isSelling,
    nivel,
    tipo: typeof item.tipo === "string" && item.tipo.trim().length > 0 ? item.tipo.trim() : undefined,
    ovr,
    isCrafting,
    nombreArchivo
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

export const mapItemRowToGameItem = (row: ItemRow): GameItem | null => {
  const nivelMinimo =
    typeof row.nivel_minimo === "number"
      ? row.nivel_minimo
      : typeof row.nivel === "number"
        ? row.nivel
        : 1;
  const imagePath = row.imagen?.trim() || (row.nombre_archivo && row.tipo ? `${row.tipo}/${row.nombre_archivo}` : undefined);

  return normalizeGameItem({
    id: String(row.id),
    name: row.nombre,
    slot: normalizeItemSlot(row.slot),
    rarity: row.rareza,
    cost: row.valor,
    image: imagePath,
    effects: buildItemEffects(row),
    dropRatePercent: row.drop,
    isDropping: row.is_dropping,
    isSelling: row.is_selling,
    nivel: nivelMinimo,
    tipo: row.tipo ?? undefined,
    ovr: row.ovr ?? undefined,
    isCrafting: row.is_crafting ?? undefined,
    nombreArchivo: row.nombre_archivo ?? undefined
  });
};

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
    slots: item.slots,
    dropRatePercent: item.dropRatePercent,
    isDropping: item.isDropping,
    isSelling: item.isSelling,
    nivel: item.nivel,
    tipo: item.tipo,
    ovr: item.ovr,
    isCrafting: item.isCrafting,
    nombreArchivo: item.nombreArchivo
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

export type DropPoolEntry = { kind: "none" } | { kind: "gold" } | { kind: "item"; item: GameItem };

export const buildDropPool = (
  items: GameItem[],
  enemy: { nivel: number; drop_bonus: number }
): DropPoolEntry[] => {
  const emptyCount = Math.round(DROP_POOL_SIZE * (clamp(DROP_EMPTY_PERCENT, 0, 100) / 100));
  const goldCount = Math.round(DROP_POOL_SIZE * (clamp(DROP_GOLD_ONLY_PERCENT, 0, 100) / 100));
  const itemSlotCount = Math.max(0, DROP_POOL_SIZE - emptyCount - goldCount);
  const pool: DropPoolEntry[] = [
    ...Array.from({ length: emptyCount }, () => ({ kind: "none" as const })),
    ...Array.from({ length: goldCount }, () => ({ kind: "gold" as const }))
  ];

  const eligible = getDropEligibleItems(items, enemy);
  if (eligible.length === 0 || itemSlotCount <= 0 || enemy.drop_bonus <= 0) {
    while (pool.length < DROP_POOL_SIZE) {
      pool.push({ kind: "none" });
    }
    return pool.slice(0, DROP_POOL_SIZE);
  }

  const weights = eligible.map((item) => item.dropRatePercent * enemy.drop_bonus);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (totalWeight <= 0) {
    while (pool.length < DROP_POOL_SIZE) {
      pool.push({ kind: "none" });
    }
    return pool.slice(0, DROP_POOL_SIZE);
  }

  let assigned = 0;
  eligible.forEach((item, index) => {
    const isLast = index === eligible.length - 1;
    const count = isLast
      ? Math.max(0, itemSlotCount - assigned)
      : Math.max(0, Math.round((weights[index] / totalWeight) * itemSlotCount));
    assigned += count;
    for (let slot = 0; slot < count; slot += 1) {
      pool.push({ kind: "item", item });
    }
  });

  while (pool.length < DROP_POOL_SIZE) {
    pool.push({ kind: "none" });
  }

  return pool.slice(0, DROP_POOL_SIZE);
};

export const rollDropOutcome = (
  items: GameItem[],
  enemy: { nivel: number; drop_bonus: number }
): DropOutcome => {
  const pool = buildDropPool(items, enemy);
  if (pool.length === 0) {
    return { kind: "none" };
  }

  const picked = pool[Math.floor(Math.random() * pool.length)];
  if (picked.kind === "gold") {
    return { kind: "gold", amount: DROP_GOLD_AMOUNT };
  }
  if (picked.kind === "item") {
    return { kind: "item", item: picked.item };
  }

  return { kind: "none" };
};

export const rollDroppedItem = (
  items: GameItem[],
  enemy: { nivel: number; drop_bonus: number }
): GameItem | null => {
  const outcome = rollDropOutcome(items, enemy);
  return outcome.kind === "item" ? outcome.item : null;
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
