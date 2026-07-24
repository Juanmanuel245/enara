export const PLAYER_STORAGE_KEY = "futrol.player";
export const GAME_STORAGE_KEY = "futrol.game";

export const DEFAULT_HERO_AGE = 16;
export const DEFAULT_HERO_VIDA = 100;
export const MAX_HERO_VIDA = 180;
export const DEFAULT_ENERGIA = 100;
export const MAX_ENERGIA = 100;
export const DEFAULT_HERO_LEVEL = 1;
export const MAX_HERO_LEVEL = 100;
/** XP base para pasar del nivel 1 al 2. Cada nivel siguiente cuesta un 15% mas. */
export const HERO_BASE_XP_TO_NEXT_LEVEL = 100;
export const HERO_XP_LEVEL_GROWTH = 1.15;

export const DEFAULT_REPUTATION_RANK = 1;
export const MAX_REPUTATION_RANK = 20;
/** Reputacion base para pasar del rango 1 al 2. Cada rango siguiente cuesta un 25% mas. */
export const REPUTATION_BASE_XP_TO_NEXT_RANK = 15;
export const REPUTATION_XP_RANK_GROWTH = 1.25;

/** Reconocimientos / status del heroe por cada rango de reputacion. */
export const REPUTATION_RANK_NAMES = [
  "Desconocido",
  "Aprendiz",
  "Forastero",
  "Conocido",
  "Respetado",
  "Estimado",
  "Renombrado",
  "Admirado",
  "Ilustre",
  "Celebre",
  "Honrado",
  "Distinguido",
  "Famoso",
  "Heroico",
  "Legendario",
  "Epico",
  "Mitico",
  "Inmortal",
  "Semidios",
  "Leyenda viviente"
] as const;

export type ReputationProgress = {
  rank: number;
  rankName: string;
  nextRankName: string | null;
  currentXp: number;
  xpToNextRank: number;
  progressPercent: number;
  isMaxRank: boolean;
};

export type HeroExperienceProgress = {
  level: number;
  currentXp: number;
  xpToNextLevel: number;
  progressPercent: number;
  isMaxLevel: boolean;
};

export const getReputationRankName = (rank: number): string => {
  const safeRank = Math.max(1, Math.min(MAX_REPUTATION_RANK, Math.round(rank)));
  return REPUTATION_RANK_NAMES[safeRank - 1] ?? REPUTATION_RANK_NAMES[0];
};

/** Reputacion necesaria para pasar de `rank` al siguiente. En rango maximo retorna 0. */
export const getXpRequiredForReputationRank = (rank: number): number => {
  const safeRank = Math.max(1, Math.round(rank));
  if (safeRank >= MAX_REPUTATION_RANK) {
    return 0;
  }

  return Math.round(REPUTATION_BASE_XP_TO_NEXT_RANK * REPUTATION_XP_RANK_GROWTH ** (safeRank - 1));
};

export type ReputationRankXpEntry = {
  rank: number;
  nextRank: number;
  rankName: string;
  nextRankName: string;
  xpToNext: number;
};

/** Tabla completa de reputacion para subir de cada rango al siguiente (1→2 … 19→20). */
export const getReputationRankXpTable = (): ReputationRankXpEntry[] =>
  Array.from({ length: MAX_REPUTATION_RANK - 1 }, (_, index) => {
    const rank = index + 1;
    return {
      rank,
      nextRank: rank + 1,
      rankName: getReputationRankName(rank),
      nextRankName: getReputationRankName(rank + 1),
      xpToNext: getXpRequiredForReputationRank(rank)
    };
  });

export const applyReputationGain = (
  reputacionNivel: number,
  reputacion: number,
  gained = 0
): { reputacionNivel: number; reputacion: number } => {
  let nextRank = Math.max(1, Math.min(MAX_REPUTATION_RANK, Math.round(reputacionNivel)));
  let xp = Math.round(reputacion) + Math.round(gained);

  if (nextRank >= MAX_REPUTATION_RANK) {
    return { reputacionNivel: MAX_REPUTATION_RANK, reputacion: 0 };
  }

  while (nextRank < MAX_REPUTATION_RANK) {
    const needed = getXpRequiredForReputationRank(nextRank);
    if (xp < needed) {
      break;
    }
    xp -= needed;
    nextRank += 1;
  }

  while (xp < 0 && nextRank > 1) {
    nextRank -= 1;
    xp += getXpRequiredForReputationRank(nextRank);
  }

  if (nextRank >= MAX_REPUTATION_RANK) {
    return { reputacionNivel: MAX_REPUTATION_RANK, reputacion: 0 };
  }

  return { reputacionNivel: nextRank, reputacion: Math.max(0, xp) };
};

export const getReputationProgress = (
  reputacion: number,
  reputacionNivel: number
): ReputationProgress => {
  const rank = Math.max(1, Math.min(MAX_REPUTATION_RANK, Math.round(reputacionNivel)));
  const isMaxRank = rank >= MAX_REPUTATION_RANK;
  const xpToNextRank = getXpRequiredForReputationRank(rank);
  const currentXp = isMaxRank ? 0 : Math.max(0, reputacion);
  const progressPercent = isMaxRank
    ? 100
    : Math.min(100, (currentXp / Math.max(1, xpToNextRank)) * 100);

  return {
    rank,
    rankName: getReputationRankName(rank),
    nextRankName: isMaxRank ? null : getReputationRankName(rank + 1),
    currentXp,
    xpToNextRank,
    progressPercent,
    isMaxRank
  };
};

/** XP necesaria para pasar de `nivel` al siguiente. En nivel maximo retorna 0. */
export const getXpRequiredForLevel = (nivel: number): number => {
  const safeLevel = Math.max(1, Math.round(nivel));
  if (safeLevel >= MAX_HERO_LEVEL) {
    return 0;
  }

  return Math.round(HERO_BASE_XP_TO_NEXT_LEVEL * HERO_XP_LEVEL_GROWTH ** (safeLevel - 1));
};

export type HeroLevelXpEntry = {
  level: number;
  nextLevel: number;
  xpToNext: number;
};

/** Tabla completa de XP para subir de cada nivel al siguiente (1→2 … 99→100). */
export const getHeroLevelXpTable = (): HeroLevelXpEntry[] =>
  Array.from({ length: MAX_HERO_LEVEL - 1 }, (_, index) => {
    const level = index + 1;
    return {
      level,
      nextLevel: level + 1,
      xpToNext: getXpRequiredForLevel(level)
    };
  });

export const applyExperienceGain = (
  nivel: number,
  experiencia: number,
  gainedXp = 0
): { nivel: number; experiencia: number } => {
  let nextNivel = Math.max(1, Math.min(MAX_HERO_LEVEL, Math.round(nivel)));
  let xp = Math.max(0, Math.round(experiencia) + Math.max(0, Math.round(gainedXp)));

  if (nextNivel >= MAX_HERO_LEVEL) {
    return { nivel: MAX_HERO_LEVEL, experiencia: 0 };
  }

  while (nextNivel < MAX_HERO_LEVEL) {
    const needed = getXpRequiredForLevel(nextNivel);
    if (xp < needed) {
      break;
    }
    xp -= needed;
    nextNivel += 1;
  }

  if (nextNivel >= MAX_HERO_LEVEL) {
    return { nivel: MAX_HERO_LEVEL, experiencia: 0 };
  }

  return { nivel: nextNivel, experiencia: xp };
};

export const getHeroExperienceProgress = (experiencia: number, nivel: number): HeroExperienceProgress => {
  const level = Math.max(1, Math.min(MAX_HERO_LEVEL, Math.round(nivel)));
  const isMaxLevel = level >= MAX_HERO_LEVEL;
  const xpToNextLevel = getXpRequiredForLevel(level);
  const currentXp = isMaxLevel ? 0 : Math.max(0, experiencia);
  const progressPercent = isMaxLevel
    ? 100
    : Math.min(100, (currentXp / Math.max(1, xpToNextLevel)) * 100);

  return {
    level,
    currentXp,
    xpToNextLevel,
    progressPercent,
    isMaxLevel
  };
};

export const PRIMARY_WEAPON_OPTIONS = [
  "Espada corta",
  "Hacha de guerra",
  "Lanza",
  "Mazo",
  "Arco largo"
] as const;

export const SECONDARY_WEAPON_OPTIONS = [
  "Ninguna",
  "Escudo",
  "Daga",
  "Antorcha",
  "Talismán"
] as const;

export type HeroStats = {
  fuerza: number;
  carisma: number;
  agilidad: number;
  suerte: number;
  reputacion: number;
  vida: number;
  vidaMax: number;
  dano: number;
  defensa: number;
};

export type HeroSecondaryStats = {
  probCritico: number;
  danoCritico: number;
  probEsquivar: number;
  probBloqueo: number;
};

export type PrimaryWeapon = (typeof PRIMARY_WEAPON_OPTIONS)[number];
export type SecondaryWeapon = (typeof SECONDARY_WEAPON_OPTIONS)[number];

export type HeroEquipment = Record<string, string | null>;

export const EQUIPMENT_LAYOUT: { key: string; label: string; span?: "hidden" }[] = [
  { key: "hombrera", label: "Hombrera" },
  { key: "casco", label: "Casco" },
  { key: "capa", label: "Capa" },
  { key: "guantes", label: "Guantes" },
  { key: "pechera", label: "Pechera" },
  { key: "brazaletes", label: "Brazaletes" },
  { key: "mano_secundaria", label: "Mano secundaria" },
  { key: "cinturon", label: "Cinturon" },
  { key: "mano_principal", label: "Mano principal" },
  { key: "slot_spacer_left", label: "", span: "hidden" },
  { key: "pantalon", label: "Pantalon" },
  { key: "slot_spacer_right", label: "", span: "hidden" },
  { key: "slot_spacer_bottom_left", label: "", span: "hidden" },
  { key: "botas", label: "Botas" },
  { key: "slot_spacer_bottom_right", label: "", span: "hidden" }
];

export const INVENTORY_CAPACITY = 12;

export type PlayerDestinoInicial = {
  id: string;
  name: string;
  image?: string;
};

export type PlayerProfile = {
  name: string;
  createdAt: string;
  stats: HeroStats;
  age: number;
  coins: number;
  energia: number;
  nivel: number;
  experiencia: number;
  /** Rango de reputacion / reconocimiento (status del heroe). */
  reputacionNivel: number;
  equipment: HeroEquipment;
  inventory: (string | null)[];
  secondaryStats: HeroSecondaryStats;
  destinoInicial?: PlayerDestinoInicial;
};

const getRandomStat = () => Math.floor(Math.random() * 10) + 1;
const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const formatEquipmentSlotLabel = (value: string | null | undefined) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : "Vacio";

export const normalizeEquipment = (raw: unknown): HeroEquipment => {
  const equipment = createInitialEquipment();

  if (!raw || typeof raw !== "object") {
    return equipment;
  }

  const source = raw as Record<string, unknown> & {
    mano_principal?: unknown;
    mano_secundaria?: unknown;
    mainHand?: unknown;
    offHand?: unknown;
  };

  Object.keys(equipment).forEach((slotKey) => {
    const value = source[slotKey];
    equipment[slotKey] = typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
  });

  const legacyMain =
    typeof source.mano_principal === "string"
      ? source.mano_principal.trim()
      : typeof source.mainHand === "string"
        ? source.mainHand.trim()
        : "";
  const legacyOff =
    typeof source.mano_secundaria === "string"
      ? source.mano_secundaria.trim()
      : typeof source.offHand === "string"
        ? source.offHand.trim()
        : "";

  if (legacyMain.length > 0 && !equipment.mano_principal) {
    equipment.mano_principal = legacyMain;
  }
  if (legacyOff.length > 0 && !equipment.mano_secundaria) {
    equipment.mano_secundaria = legacyOff;
  }

  return equipment;
};

export type InventoryMutationResult =
  | { ok: true; player: PlayerProfile; message?: string }
  | { ok: false; player: PlayerProfile; message: string };

export const addItemToInventory = (player: PlayerProfile, itemId: string): InventoryMutationResult => {
  const emptyIndex = player.inventory.findIndex((slot) => slot === null);
  if (emptyIndex === -1) {
    return { ok: false, player, message: "Inventario lleno." };
  }

  const nextInventory = [...player.inventory];
  nextInventory[emptyIndex] = itemId;

  return {
    ok: true,
    player: {
      ...player,
      inventory: nextInventory
    }
  };
};

export const sellItemFromInventoryAt = (
  player: PlayerProfile,
  slotIndex: number,
  sellPrice: number
): InventoryMutationResult => {
  const inventoryItemId = player.inventory[slotIndex];
  if (!inventoryItemId) {
    return { ok: false, player, message: "No hay item en ese slot." };
  }

  const withoutItem = removeItemFromInventoryAt(player, slotIndex);

  return {
    ok: true,
    player: {
      ...withoutItem,
      coins: withoutItem.coins + sellPrice
    },
    message: `Vendiste el item por ${sellPrice} monedas.`
  };
};

export const buyItemToInventory = (
  player: PlayerProfile,
  itemId: string,
  buyPrice: number
): InventoryMutationResult => {
  if (player.coins < buyPrice) {
    return { ok: false, player, message: "No tenes monedas suficientes." };
  }

  const inventoryResult = addItemToInventory(player, itemId);
  if (!inventoryResult.ok) {
    return inventoryResult;
  }

  return {
    ok: true,
    player: {
      ...inventoryResult.player,
      coins: inventoryResult.player.coins - buyPrice
    },
    message: "Compraste el item."
  };
};

export const removeItemFromInventoryAt = (player: PlayerProfile, slotIndex: number): PlayerProfile => {
  if (slotIndex < 0 || slotIndex >= player.inventory.length) {
    return player;
  }

  const nextInventory = [...player.inventory];
  nextInventory[slotIndex] = null;

  return {
    ...player,
    inventory: nextInventory
  };
};

export const applyItemEffectsToPlayer = (
  player: PlayerProfile,
  effects: Partial<Record<keyof HeroStats, number>>
): PlayerProfile => {
  const next: HeroStats = { ...player.stats };
  const reputationDelta = effects.reputacion ?? 0;

  (Object.keys(effects) as (keyof HeroStats)[]).forEach((key) => {
    if (key === "reputacion") {
      return;
    }
    if (key === "dano") {
      next.fuerza += effects[key] ?? 0;
      return;
    }
    next[key] = next[key] + (effects[key] ?? 0);
  });

  const ranked = applyReputationGain(player.reputacionNivel, player.stats.reputacion, reputationDelta);

  return {
    ...player,
    reputacionNivel: ranked.reputacionNivel,
    stats: {
      fuerza: clamp(next.fuerza, 1, 30),
      carisma: clamp(next.carisma, 1, 30),
      agilidad: clamp(next.agilidad, 1, 30),
      suerte: clamp(next.suerte, 1, 30),
      reputacion: ranked.reputacion,
      vida: clamp(next.vida, 1, next.vidaMax),
      vidaMax: clamp(next.vidaMax, DEFAULT_HERO_VIDA, MAX_HERO_VIDA),
      dano: 0,
      defensa: clamp(next.defensa, 0, 30)
    }
  };
};

export const consumeItemFromInventory = (
  player: PlayerProfile,
  slotIndex: number,
  item: { effects: Partial<Record<keyof HeroStats, number>> }
): InventoryMutationResult => {
  const inventoryItemId = player.inventory[slotIndex];
  if (!inventoryItemId) {
    return { ok: false, player, message: "No hay item en ese slot." };
  }

  const withoutItem = removeItemFromInventoryAt(player, slotIndex);
  const updated = applyItemEffectsToPlayer(withoutItem, item.effects);

  return {
    ok: true,
    player: updated,
    message: "Consumiste el item."
  };
};

export const equipItemFromInventory = (
  player: PlayerProfile,
  slotIndex: number,
  item: { id: string; slot: string }
): InventoryMutationResult => {
  const inventoryItemId = player.inventory[slotIndex];
  if (!inventoryItemId || inventoryItemId !== item.id) {
    return { ok: false, player, message: "No hay item en ese slot." };
  }

  const equipmentSlot = item.slot.trim();
  if (!equipmentSlot || equipmentSlot === "consumible") {
    return { ok: false, player, message: "Este item no se puede equipar." };
  }

  const nextEquipment: HeroEquipment = { ...player.equipment };
  if (!(equipmentSlot in nextEquipment)) {
    nextEquipment[equipmentSlot] = null;
  }

  const previouslyEquippedId = nextEquipment[equipmentSlot];
  const nextInventory = [...player.inventory];
  nextInventory[slotIndex] = previouslyEquippedId;
  nextEquipment[equipmentSlot] = item.id;

  return {
    ok: true,
    player: {
      ...player,
      inventory: nextInventory,
      equipment: nextEquipment
    },
    message: previouslyEquippedId ? "Intercambiaste el item equipado." : "Equipaste el item."
  };
};

export const unequipItemToInventory = (
  player: PlayerProfile,
  equipmentSlot: string
): InventoryMutationResult => {
  const slotKey = equipmentSlot.trim();
  if (!slotKey || !(slotKey in player.equipment)) {
    return { ok: false, player, message: "Slot de equipo invalido." };
  }

  const equippedItemId = player.equipment[slotKey];
  if (!equippedItemId) {
    return { ok: false, player, message: "No hay item equipado en ese slot." };
  }

  const emptyInventoryIndex = player.inventory.findIndex((inventoryItemId) => inventoryItemId === null);
  if (emptyInventoryIndex === -1) {
    return { ok: false, player, message: "Inventario lleno." };
  }

  const nextEquipment: HeroEquipment = { ...player.equipment, [slotKey]: null };
  const nextInventory = [...player.inventory];
  nextInventory[emptyInventoryIndex] = equippedItemId;

  return {
    ok: true,
    player: {
      ...player,
      equipment: nextEquipment,
      inventory: nextInventory
    },
    message: "Desequipaste el item."
  };
};

export const migrateLegacyEquipmentIds = (
  player: PlayerProfile,
  items: { id: string; name: string }[]
): PlayerProfile => {
  const equipment: HeroEquipment = { ...player.equipment };
  let changed = false;

  Object.keys(equipment).forEach((slotKey) => {
    const value = equipment[slotKey];
    if (!value) {
      return;
    }
    if (items.some((item) => item.id === value)) {
      return;
    }
    const byName = items.find((item) => item.name === value);
    if (byName) {
      equipment[slotKey] = byName.id;
      changed = true;
    }
  });

  return changed ? { ...player, equipment } : player;
};

export const getEquippedItemIds = (equipment: HeroEquipment) =>
  Object.values(equipment).filter((itemId): itemId is string => typeof itemId === "string" && itemId.length > 0);

export const createInitialStats = (): HeroStats => ({
  fuerza: getRandomStat(),
  carisma: getRandomStat(),
  agilidad: getRandomStat(),
  suerte: getRandomStat(),
  reputacion: 0,
  vida: DEFAULT_HERO_VIDA,
  vidaMax: DEFAULT_HERO_VIDA,
  dano: 0,
  defensa: 0
});

export const createInitialEquipment = (): HeroEquipment =>
  Object.fromEntries(EQUIPMENT_LAYOUT.filter((slot) => slot.span !== "hidden").map((slot) => [slot.key, null]));

export const createInitialInventory = (): (string | null)[] =>
  Array.from({ length: INVENTORY_CAPACITY }, () => null);

export const createInitialSecondaryStats = (): HeroSecondaryStats => ({
  probCritico: 1,
  danoCritico: 110,
  probEsquivar: 0,
  probBloqueo: 0
});

type DestinoStatsBonus = {
  id: string;
  name: string;
  image?: string;
  fuerza: number;
  agilidad: number;
  carisma: number;
  suerte: number;
  reputacion: number;
  oro: number;
  experiencia: number;
};

export const applyDestinoInicialToProfile = (
  basePlayer: PlayerProfile,
  destino: DestinoStatsBonus
): PlayerProfile => {
  const leveled = applyExperienceGain(basePlayer.nivel, basePlayer.experiencia, destino.experiencia);
  const ranked = applyReputationGain(
    basePlayer.reputacionNivel,
    basePlayer.stats.reputacion,
    destino.reputacion
  );

  return {
    ...basePlayer,
    stats: {
      ...basePlayer.stats,
      fuerza: clamp(basePlayer.stats.fuerza + destino.fuerza, 1, 30),
      carisma: clamp(basePlayer.stats.carisma + destino.carisma, 1, 30),
      agilidad: clamp(basePlayer.stats.agilidad + destino.agilidad, 1, 30),
      suerte: clamp(basePlayer.stats.suerte + destino.suerte, 1, 30),
      reputacion: ranked.reputacion
    },
    coins: Math.max(0, basePlayer.coins + destino.oro),
    nivel: leveled.nivel,
    experiencia: leveled.experiencia,
    reputacionNivel: ranked.reputacionNivel,
    destinoInicial: {
      id: destino.id.trim(),
      name: destino.name.trim(),
      image: typeof destino.image === "string" && destino.image.trim().length > 0 ? destino.image : undefined
    }
  };
};

const normalizeSecondaryStats = (raw: unknown): HeroSecondaryStats => {
  const fallback = createInitialSecondaryStats();
  if (!raw || typeof raw !== "object") {
    return fallback;
  }

  const source = raw as Partial<HeroSecondaryStats>;
  return {
    probCritico: isFiniteNumber(source.probCritico) ? clamp(source.probCritico, 0, 100) : fallback.probCritico,
    danoCritico: isFiniteNumber(source.danoCritico) ? clamp(source.danoCritico, 100, 300) : fallback.danoCritico,
    probEsquivar: isFiniteNumber(source.probEsquivar) ? clamp(source.probEsquivar, 0, 100) : fallback.probEsquivar,
    probBloqueo: isFiniteNumber(source.probBloqueo) ? clamp(source.probBloqueo, 0, 100) : fallback.probBloqueo
  };
};

export const normalizeInventory = (raw: unknown): (string | null)[] => {
  const slots = createInitialInventory();
  if (!Array.isArray(raw)) {
    return slots;
  }

  raw.forEach((entry, index) => {
    if (index >= INVENTORY_CAPACITY) {
      return;
    }
    slots[index] = typeof entry === "string" && entry.trim().length > 0 ? entry.trim() : null;
  });

  return slots;
};

export const parseStoredPlayer = (rawPlayer: string | null): PlayerProfile | null => {
  if (!rawPlayer) {
    return null;
  }

  try {
    const player = JSON.parse(rawPlayer) as Partial<PlayerProfile>;
    if (typeof player?.name !== "string" || player.name.trim().length < 2) {
      return null;
    }

    const statsFallback = createInitialStats();
    let vida = isFiniteNumber(player?.stats?.vida) ? clamp(player.stats.vida, 1, MAX_HERO_VIDA) : DEFAULT_HERO_VIDA;
    let vidaMax = isFiniteNumber(player?.stats?.vidaMax)
      ? clamp(player.stats.vidaMax, DEFAULT_HERO_VIDA, MAX_HERO_VIDA)
      : Math.max(DEFAULT_HERO_VIDA, vida);
    if (vida > vidaMax) {
      vidaMax = clamp(vida, DEFAULT_HERO_VIDA, MAX_HERO_VIDA);
    }
    vida = clamp(vida, 1, vidaMax);

    const legacyDano = isFiniteNumber(player?.stats?.dano) ? clamp(player.stats.dano, 0, 30) : statsFallback.dano;
    const stats = {
      fuerza: clamp(
        (isFiniteNumber(player?.stats?.fuerza) ? player.stats.fuerza : statsFallback.fuerza) + legacyDano,
        1,
        30
      ),
      carisma: isFiniteNumber(player?.stats?.carisma) ? clamp(player.stats.carisma, 1, 30) : statsFallback.carisma,
      agilidad: isFiniteNumber(player?.stats?.agilidad) ? clamp(player.stats.agilidad, 1, 30) : statsFallback.agilidad,
      suerte: isFiniteNumber(player?.stats?.suerte) ? clamp(player.stats.suerte, 1, 30) : statsFallback.suerte,
      reputacion: isFiniteNumber(player?.stats?.reputacion) ? Math.max(0, player.stats.reputacion) : 0,
      vida,
      vidaMax,
      dano: 0,
      defensa: isFiniteNumber(player?.stats?.defensa) ? clamp(player.stats.defensa, 0, 30) : statsFallback.defensa
    } satisfies HeroStats;

    const legacyEquipment = player?.equipment;
    const equipment = normalizeEquipment(legacyEquipment);
    const destinoRaw = player?.destinoInicial;
    const destinoInicial =
      destinoRaw &&
      typeof destinoRaw === "object" &&
      typeof destinoRaw.id === "string" &&
      destinoRaw.id.trim().length > 0 &&
      typeof destinoRaw.name === "string" &&
      destinoRaw.name.trim().length > 0
        ? {
            id: destinoRaw.id.trim(),
            name: destinoRaw.name.trim(),
            image:
              typeof destinoRaw.image === "string" && destinoRaw.image.trim().length > 0
                ? destinoRaw.image.trim()
                : undefined
          }
        : undefined;

    const rawReputacion = stats.reputacion;
    const ranked = isFiniteNumber(player.reputacionNivel)
      ? applyReputationGain(
          Math.max(1, Math.min(MAX_REPUTATION_RANK, Math.round(player.reputacionNivel))),
          rawReputacion,
          0
        )
      : // Partidas viejas: reputacion era acumulada total → convertir a rango + progreso.
        applyReputationGain(DEFAULT_REPUTATION_RANK, 0, rawReputacion);
    stats.reputacion = ranked.reputacion;

    return {
      name: player.name.trim(),
      createdAt: typeof player.createdAt === "string" ? player.createdAt : new Date().toISOString(),
      stats,
      age: isFiniteNumber(player.age) ? clamp(Math.round(player.age), DEFAULT_HERO_AGE, 99) : DEFAULT_HERO_AGE,
      coins: isFiniteNumber(player.coins) ? Math.max(0, Math.round(player.coins)) : 0,
      energia: isFiniteNumber(player.energia)
        ? clamp(Math.round(player.energia), 0, MAX_ENERGIA)
        : DEFAULT_ENERGIA,
      nivel: isFiniteNumber(player.nivel)
        ? Math.max(1, Math.min(MAX_HERO_LEVEL, Math.round(player.nivel)))
        : DEFAULT_HERO_LEVEL,
      experiencia: isFiniteNumber(player.experiencia) ? Math.max(0, Math.round(player.experiencia)) : 0,
      reputacionNivel: ranked.reputacionNivel,
      equipment,
      inventory: normalizeInventory(player.inventory),
      secondaryStats: normalizeSecondaryStats(player.secondaryStats),
      destinoInicial
    } satisfies PlayerProfile;
  } catch {
    return null;
  }
};
