import localMissionsCatalog from "@/data/misiones.json";
import { type HeroStats, type PlayerProfile } from "@/lib/player";

export type MissionOption = {
  id: string;
  text: string;
  effects: Partial<Record<keyof HeroStats, number>>;
  response?: string;
};

export type MissionType = "vida" | "situacion";

export type Mission = {
  id: string;
  title: string;
  description: string;
  type: MissionType;
  minLevel: number;
  maxLevel: number;
  minReputation: number;
  options: MissionOption[];
};

export type MisionRow = {
  idmision: number | string;
  titulo: string;
  descripcion: string;
  tipo: string;
  nivel_minimo: number | string;
  nivel_maximo: number | string;
  reputacion_minima: number | string;
  opcion1: string | null;
  respuesta1: string | null;
  resultado1: unknown;
  opcion2: string | null;
  respuesta2: string | null;
  resultado2: unknown;
  opcion3: string | null;
  respuesta3: string | null;
  resultado3: unknown;
};

export const MISION_SELECT_COLUMNS =
  "idmision, titulo, descripcion, tipo, nivel_minimo, nivel_maximo, reputacion_minima, opcion1, respuesta1, resultado1, opcion2, respuesta2, resultado2, opcion3, respuesta3, resultado3";

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

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const toNumber = (value: unknown): number | null => {
  if (isFiniteNumber(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const normalizeEffects = (effects: unknown): MissionOption["effects"] => {
  if (!effects || typeof effects !== "object") {
    return {};
  }

  const source = effects as Record<string, unknown>;
  const normalized: MissionOption["effects"] = {};

  for (const key of allowedEffectKeys) {
    const raw = source[key];
    if (isFiniteNumber(raw)) {
      normalized[key] = raw;
    }
  }

  return normalized;
};

const normalizeMissionType = (value: unknown): MissionType | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "vida" || normalized === "life") {
    return "vida";
  }
  if (normalized === "situacion" || normalized === "situation") {
    return "situacion";
  }

  return null;
};

const buildOptionFromRaw = (raw: unknown, fallbackIdPrefix: string, index: number): MissionOption | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const item = raw as { id?: unknown; text?: unknown; effects?: unknown; response?: unknown };
  if (typeof item.text !== "string" || item.text.trim().length === 0) {
    return null;
  }

  const baseId = typeof item.id === "string" && item.id.trim().length > 0 ? item.id.trim() : `${fallbackIdPrefix}o${index + 1}`;
  const response = typeof item.response === "string" && item.response.trim().length > 0 ? item.response.trim() : undefined;

  return {
    id: baseId,
    text: item.text.trim(),
    effects: normalizeEffects(item.effects),
    response
  };
};

export const normalizeMission = (raw: unknown): Mission | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const item = raw as Record<string, unknown>;
  const id = typeof item.id === "string" ? item.id.trim() : "";
  const title = typeof item.title === "string" ? item.title.trim() : "";
  const description = typeof item.description === "string" ? item.description.trim() : "";

  if (!id || !title || !description) {
    return null;
  }

  const type = normalizeMissionType(item.type) ?? "vida";
  const minLevel = Math.max(1, Math.round(toNumber(item.minLevel) ?? 1));
  const maxLevel = Math.max(minLevel, Math.round(toNumber(item.maxLevel) ?? 99));
  const minReputation = Math.round(toNumber(item.minReputation) ?? 0);

  const rawOptions = Array.isArray(item.options) ? item.options : [];
  const options = rawOptions
    .map((option, index) => buildOptionFromRaw(option, id, index))
    .filter((option): option is MissionOption => option !== null);

  if (options.length === 0) {
    return null;
  }

  return {
    id,
    title,
    description,
    type,
    minLevel,
    maxLevel,
    minReputation,
    options
  };
};

const buildOptionFromColumn = (
  missionId: string,
  optionText: string | null | undefined,
  optionResponse: string | null | undefined,
  optionEffects: unknown,
  index: number
): MissionOption | null => {
  if (typeof optionText !== "string" || optionText.trim().length === 0) {
    return null;
  }

  const normalizedResponse =
    typeof optionResponse === "string" && optionResponse.trim().length > 0 ? optionResponse.trim() : undefined;

  return {
    id: `${missionId}o${index + 1}`,
    text: optionText.trim(),
    effects: normalizeEffects(optionEffects),
    response: normalizedResponse
  };
};

export const mapMisionRowToMission = (row: MisionRow): Mission | null => {
  const missionIdNumeric = toNumber(row.idmision);
  if (missionIdNumeric === null) {
    return null;
  }

  const missionId = String(Math.round(missionIdNumeric));
  const type = normalizeMissionType(row.tipo) ?? "vida";
  const minLevel = Math.max(1, Math.round(toNumber(row.nivel_minimo) ?? 1));
  const maxLevel = Math.max(minLevel, Math.round(toNumber(row.nivel_maximo) ?? 99));
  const minReputation = Math.round(toNumber(row.reputacion_minima) ?? 0);

  const option1 = buildOptionFromColumn(missionId, row.opcion1, row.respuesta1, row.resultado1, 0);
  const option2 = buildOptionFromColumn(missionId, row.opcion2, row.respuesta2, row.resultado2, 1);
  const option3 = buildOptionFromColumn(missionId, row.opcion3, row.respuesta3, row.resultado3, 2);
  const options = [option1, option2, option3].filter((option): option is MissionOption => option !== null);

  if (!row.titulo?.trim() || !row.descripcion?.trim() || options.length === 0) {
    return null;
  }

  return {
    id: missionId,
    title: row.titulo.trim(),
    description: row.descripcion.trim(),
    type,
    minLevel,
    maxLevel,
    minReputation,
    options
  };
};

export const mapMisionRowToMissionJson = (row: MisionRow) => {
  const mission = mapMisionRowToMission(row);
  if (!mission) {
    return null;
  }

  return {
    id: mission.id,
    title: mission.title,
    description: mission.description,
    type: mission.type,
    minLevel: mission.minLevel,
    maxLevel: mission.maxLevel,
    minReputation: mission.minReputation,
    options: mission.options
  };
};

export const getLocalMissions = (): Mission[] =>
  (localMissionsCatalog as unknown[]).map(normalizeMission).filter((mission): mission is Mission => mission !== null);

export const fetchMissions = async (): Promise<Mission[]> => {
  try {
    const response = await fetch("/api/misiones");
    if (!response.ok) {
      return getLocalMissions();
    }

    const payload = (await response.json()) as { items?: unknown[] };
    const normalized = (payload.items ?? [])
      .map(normalizeMission)
      .filter((mission): mission is Mission => mission !== null);

    return normalized.length > 0 ? normalized : getLocalMissions();
  } catch {
    return getLocalMissions();
  }
};

export const filterEligibleMissions = (missions: Mission[], player: PlayerProfile): Mission[] =>
  missions.filter(
    (mission) =>
      player.nivel >= mission.minLevel &&
      player.nivel <= mission.maxLevel &&
      player.stats.reputacion >= mission.minReputation
  );

export const splitMissionsByType = (missions: Mission[]) => {
  const lifeMissions = missions.filter((mission) => mission.type === "vida");
  const situationMissions = missions.filter((mission) => mission.type === "situacion");

  if (lifeMissions.length > 0 && situationMissions.length > 0) {
    return { lifeMissions, situationMissions };
  }

  const middle = Math.ceil(missions.length / 2);
  return {
    lifeMissions: missions.slice(0, middle),
    situationMissions: missions.slice(middle)
  };
};

export const warmupMissionsCatalog = async (): Promise<void> => {
  try {
    await fetchMissions();
  } catch {
    // No bloqueamos la partida si falla la precarga.
  }
};
