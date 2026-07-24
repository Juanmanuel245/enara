import { DEFAULT_HERO_AGE, MAX_CAMPAIGN_TURNS, RETIREMENT_AGE, type PlayerProfile } from "@/lib/player";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export { MAX_CAMPAIGN_TURNS, RETIREMENT_AGE };

export type RetirementReason = "age" | "death" | "missions";

export type CampaignStats = {
  enemiesKilled: number;
  goldEarned: number;
  maxDamageDealt: number;
};

export const createInitialCampaignStats = (startingCoins = 0): CampaignStats => ({
  enemiesKilled: 0,
  goldEarned: Math.max(0, Math.round(startingCoins)),
  maxDamageDealt: 0
});

export const normalizeCampaignStats = (raw: unknown, fallbackCoins = 0): CampaignStats => {
  const fallback = createInitialCampaignStats(fallbackCoins);
  if (!raw || typeof raw !== "object") {
    return fallback;
  }

  const source = raw as Partial<CampaignStats>;
  return {
    enemiesKilled:
      typeof source.enemiesKilled === "number" && Number.isFinite(source.enemiesKilled)
        ? Math.max(0, Math.round(source.enemiesKilled))
        : fallback.enemiesKilled,
    goldEarned:
      typeof source.goldEarned === "number" && Number.isFinite(source.goldEarned)
        ? Math.max(0, Math.round(source.goldEarned))
        : fallback.goldEarned,
    maxDamageDealt:
      typeof source.maxDamageDealt === "number" && Number.isFinite(source.maxDamageDealt)
        ? Math.max(0, Math.round(source.maxDamageDealt))
        : fallback.maxDamageDealt
  };
};

export const calculateFinalScore = (
  player: PlayerProfile,
  stats: CampaignStats,
  turnsPlayed: number
): number => {
  const turns = Math.max(0, Math.round(turnsPlayed));
  const score =
    stats.enemiesKilled * 150 +
    stats.goldEarned * 0.5 +
    stats.maxDamageDealt * 3 +
    player.reputacionNivel * 400 +
    player.nivel * 75 +
    turns * 25;

  return Math.round(score);
};

export type PuntajePayload = {
  heroe: string;
  oro: number;
  danio_maximo: number;
  reputacion: number;
  puntaje: number;
};

export type PuntajeRecord = {
  idpuntaje: string;
  heroe: string;
  oro: number;
  danio_maximo: number;
  reputacion: number;
  puntaje: number;
  created_at: string;
};

const PUNTAJES_SELECT_COLUMNS =
  "idpuntaje, heroe, oro, danio_maximo, reputacion, puntaje, created_at";

const toNumber = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const normalizePuntajeRow = (raw: unknown): PuntajeRecord | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const row = raw as Record<string, unknown>;
  const id = typeof row.idpuntaje === "string" ? row.idpuntaje.trim() : "";
  const heroe = typeof row.heroe === "string" ? row.heroe.trim() : "";
  const createdAt = typeof row.created_at === "string" ? row.created_at : "";

  if (!id || !heroe || !createdAt) {
    return null;
  }

  return {
    idpuntaje: id,
    heroe,
    oro: Math.max(0, Math.round(toNumber(row.oro))),
    danio_maximo: Math.max(0, Math.round(toNumber(row.danio_maximo))),
    reputacion: Math.max(0, Math.round(toNumber(row.reputacion))),
    puntaje: Math.max(0, Math.round(toNumber(row.puntaje))),
    created_at: createdAt
  };
};

export const fetchPuntajes = async (limit = 100): Promise<PuntajeRecord[]> => {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return [];
  }

  const safeLimit = Math.max(1, Math.min(200, Math.round(limit)));

  const { data, error } = await supabase
    .from("puntajes" as never)
    .select(PUNTAJES_SELECT_COLUMNS as never)
    .order("puntaje", { ascending: false })
    .limit(safeLimit);

  if (error || !data) {
    return [];
  }

  return (data as unknown[])
    .map(normalizePuntajeRow)
    .filter((row): row is PuntajeRecord => row !== null);
};

export const submitPuntaje = async (payload: PuntajePayload): Promise<void> => {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    throw new Error("Supabase no esta configurado.");
  }

  const { error } = await supabase.from("puntajes" as never).insert(payload as never);

  if (error) {
    throw error;
  }
};

export const getRetirementMessage = (reason: RetirementReason): string => {
  switch (reason) {
    case "age":
      return "Llegaste a los 100 años y te retiraste del oficio de aventurero.";
    case "death":
      return "Caíste en batalla. Tu leyenda termina aquí.";
    case "missions":
      return "Completaste todas tus misiones de vida y decidiste retirarte.";
  }
};
