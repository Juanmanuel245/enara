export const PLAYER_STORAGE_KEY = "futrol.player";
export const GAME_STORAGE_KEY = "futrol.game";

export const DEFAULT_HERO_AGE = 16;
export const DEFAULT_HERO_VIDA = 100;
export const MAX_HERO_VIDA = 180;
export const DEFAULT_ENERGIA = 100;
export const MAX_ENERGIA = 100;
export const INITIAL_REPUTATION_RANK_NAME = "Desconocido";
export const REPUTATION_XP_TO_NEXT_RANK = 10;
export const DEFAULT_HERO_LEVEL = 1;
export const HERO_XP_TO_NEXT_LEVEL = 100;

export type ReputationProgress = {
  rankName: string;
  currentXp: number;
  xpToNextRank: number;
  progressPercent: number;
};

export type HeroExperienceProgress = {
  level: number;
  currentXp: number;
  xpToNextLevel: number;
  progressPercent: number;
};

export const getReputationProgress = (reputacion: number): ReputationProgress => {
  const xpToNextRank = REPUTATION_XP_TO_NEXT_RANK;
  const currentXp = Math.max(0, reputacion);
  const progressPercent = Math.min(100, (currentXp / xpToNextRank) * 100);

  return {
    rankName: INITIAL_REPUTATION_RANK_NAME,
    currentXp,
    xpToNextRank,
    progressPercent
  };
};

export const getHeroExperienceProgress = (experiencia: number, nivel: number): HeroExperienceProgress => {
  const xpToNextLevel = HERO_XP_TO_NEXT_LEVEL;
  const currentXp = Math.max(0, experiencia);
  const progressPercent = Math.min(100, (currentXp / xpToNextLevel) * 100);

  return {
    level: Math.max(1, nivel),
    currentXp,
    xpToNextLevel,
    progressPercent
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

export type HeroEquipment = {
  mano_principal: string;
  mano_secundaria: string;
};

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
  equipment: HeroEquipment;
  inventory: (string | null)[];
  secondaryStats: HeroSecondaryStats;
  destinoInicial?: PlayerDestinoInicial;
};

const getRandomStat = () => Math.floor(Math.random() * 10) + 1;
const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const formatEquipmentSlotLabel = (value: string) => (value.trim().length > 0 ? value.trim() : "Vacio");

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

export const createInitialEquipment = (): HeroEquipment => ({
  mano_principal: "",
  mano_secundaria: ""
});

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
): PlayerProfile => ({
  ...basePlayer,
  stats: {
    ...basePlayer.stats,
    fuerza: clamp(basePlayer.stats.fuerza + destino.fuerza, 1, 30),
    carisma: clamp(basePlayer.stats.carisma + destino.carisma, 1, 30),
    agilidad: clamp(basePlayer.stats.agilidad + destino.agilidad, 1, 30),
    suerte: clamp(basePlayer.stats.suerte + destino.suerte, 1, 30),
    reputacion: Math.max(0, basePlayer.stats.reputacion + destino.reputacion)
  },
  coins: Math.max(0, basePlayer.coins + destino.oro),
  experiencia: Math.max(0, basePlayer.experiencia + destino.experiencia),
  destinoInicial: {
    id: destino.id.trim(),
    name: destino.name.trim(),
    image: typeof destino.image === "string" && destino.image.trim().length > 0 ? destino.image : undefined
  }
});

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

    const stats = {
      fuerza: isFiniteNumber(player?.stats?.fuerza) ? clamp(player.stats.fuerza, 1, 30) : statsFallback.fuerza,
      carisma: isFiniteNumber(player?.stats?.carisma) ? clamp(player.stats.carisma, 1, 30) : statsFallback.carisma,
      agilidad: isFiniteNumber(player?.stats?.agilidad) ? clamp(player.stats.agilidad, 1, 30) : statsFallback.agilidad,
      suerte: isFiniteNumber(player?.stats?.suerte) ? clamp(player.stats.suerte, 1, 30) : statsFallback.suerte,
      reputacion: isFiniteNumber(player?.stats?.reputacion) ? Math.max(0, player.stats.reputacion) : 0,
      vida,
      vidaMax,
      dano: isFiniteNumber(player?.stats?.dano) ? clamp(player.stats.dano, 0, 30) : statsFallback.dano,
      defensa: isFiniteNumber(player?.stats?.defensa) ? clamp(player.stats.defensa, 0, 30) : statsFallback.defensa
    } satisfies HeroStats;

    const legacyEquipment = player?.equipment as
      | (Partial<HeroEquipment> & { mainHand?: string; offHand?: string })
      | undefined;
    const manoPrincipal =
      typeof legacyEquipment?.mano_principal === "string"
        ? legacyEquipment.mano_principal.trim()
        : typeof legacyEquipment?.mainHand === "string"
          ? legacyEquipment.mainHand.trim()
          : "";
    const manoSecundaria =
      typeof legacyEquipment?.mano_secundaria === "string"
        ? legacyEquipment.mano_secundaria.trim()
        : typeof legacyEquipment?.offHand === "string"
          ? legacyEquipment.offHand.trim()
          : "";
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

    return {
      name: player.name.trim(),
      createdAt: typeof player.createdAt === "string" ? player.createdAt : new Date().toISOString(),
      stats,
      age: isFiniteNumber(player.age) ? clamp(Math.round(player.age), DEFAULT_HERO_AGE, 99) : DEFAULT_HERO_AGE,
      coins: isFiniteNumber(player.coins) ? Math.max(0, Math.round(player.coins)) : 0,
      energia: isFiniteNumber(player.energia)
        ? clamp(Math.round(player.energia), 0, MAX_ENERGIA)
        : DEFAULT_ENERGIA,
      nivel: isFiniteNumber(player.nivel) ? Math.max(1, Math.round(player.nivel)) : DEFAULT_HERO_LEVEL,
      experiencia: isFiniteNumber(player.experiencia) ? Math.max(0, Math.round(player.experiencia)) : 0,
      equipment: {
        mano_principal: manoPrincipal,
        mano_secundaria: manoSecundaria
      },
      inventory: normalizeInventory(player.inventory),
      secondaryStats: normalizeSecondaryStats(player.secondaryStats),
      destinoInicial
    } satisfies PlayerProfile;
  } catch {
    return null;
  }
};
