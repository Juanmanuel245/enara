import type { HeroStats } from "@/lib/player";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import localWeaponCatalog from "@/data/items_weapons.json";

export type WeaponItem = {
  id: string;
  name: string;
  slot: "mano_principal" | "mano_secundaria";
  rarity: string;
  cost: number;
  image?: string;
  effects: Partial<Record<keyof HeroStats, number>>;
  dropRatePercent: number;
};

export type ArmaRow = {
  idarma: number;
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
};

export const ARMA_SELECT_COLUMNS =
  "idarma, nombre, valor, drop, is_dropping, is_selling, imagen, slot, ataque, defensa, agilidad, salud, rareza, tipo";

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

const normalizeEffects = (effects: unknown): WeaponItem["effects"] => {
  if (!effects || typeof effects !== "object") {
    return {};
  }

  const source = effects as Record<string, unknown>;
  const normalized: WeaponItem["effects"] = {};

  for (const key of allowedEffectKeys) {
    const raw = source[key];
    if (typeof raw === "number" && Number.isFinite(raw)) {
      normalized[key] = raw;
    }
  }

  return normalized;
};

export const normalizeWeaponItem = (weapon: unknown): WeaponItem | null => {
  if (!weapon || typeof weapon !== "object") {
    return null;
  }

  const item = weapon as Partial<WeaponItem>;
  if (
    typeof item.id !== "string" ||
    typeof item.name !== "string" ||
    (item.slot !== "mano_principal" && item.slot !== "mano_secundaria") ||
    typeof item.rarity !== "string" ||
    typeof item.cost !== "number" ||
    typeof item.dropRatePercent !== "number"
  ) {
    return null;
  }

  return {
    id: item.id,
    name: item.name,
    slot: item.slot,
    rarity: item.rarity,
    cost: Math.max(0, Math.round(item.cost)),
    image: typeof item.image === "string" ? item.image : undefined,
    effects: normalizeEffects(item.effects),
    dropRatePercent: clamp(item.dropRatePercent, 0, 100)
  };
};

const normalizeWeaponSlot = (slot: string): WeaponItem["slot"] | null => {
  if (slot === "mano_principal" || slot === "mainHand") {
    return "mano_principal";
  }

  if (slot === "mano_secundaria" || slot === "offHand") {
    return "mano_secundaria";
  }

  return null;
};

const buildWeaponEffects = (row: ArmaRow): WeaponItem["effects"] => {
  const effects: WeaponItem["effects"] = {};

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

export const mapArmaRowToWeaponItem = (row: ArmaRow): WeaponItem | null => {
  const slot = normalizeWeaponSlot(row.slot);
  if (!slot) {
    return null;
  }

  return normalizeWeaponItem({
    id: String(row.idarma),
    name: row.nombre,
    slot,
    rarity: row.rareza,
    cost: row.valor,
    image: row.imagen,
    effects: buildWeaponEffects(row),
    dropRatePercent: row.drop
  });
};

export const mapArmaRowToWeaponJson = (row: ArmaRow) => {
  const item = mapArmaRowToWeaponItem(row);
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
    dropRatePercent: item.dropRatePercent
  };
};

export const getLocalWeaponItems = (): WeaponItem[] =>
  (localWeaponCatalog as unknown[]).map(normalizeWeaponItem).filter((item): item is WeaponItem => item !== null);

export const fetchWeaponItems = async (): Promise<WeaponItem[]> => {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return getLocalWeaponItems();
  }

  const { data, error } = await supabase
    .from("armas")
    .select(ARMA_SELECT_COLUMNS)
    .eq("is_dropping", true)
    .order("idarma", { ascending: true });

  if (error || !data) {
    return getLocalWeaponItems();
  }

  const normalized = (data as ArmaRow[])
    .map(mapArmaRowToWeaponItem)
    .filter((item): item is WeaponItem => item !== null);

  return normalized.length > 0 ? normalized : getLocalWeaponItems();
};

export const warmupWeaponCatalog = async (): Promise<void> => {
  try {
    await fetchWeaponItems();
  } catch {
    // No bloqueamos la creacion de personaje si falla la precarga.
  }
};
