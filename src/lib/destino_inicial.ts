import { getSupabaseBrowserClient } from "@/lib/supabase";
import localDestinoCatalog from "@/data/destino_inicial.json";

export type DestinoInicialItem = {
  id: string;
  name: string;
  description: string;
  fuerza: number;
  agilidad: number;
  carisma: number;
  suerte: number;
  oro: number;
  experiencia: number;
  reputacion: number;
  image?: string;
};

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

const normalizeDestinoImagePath = (image: string | null | undefined) => {
  if (typeof image !== "string" || image.trim().length === 0) {
    return undefined;
  }

  const trimmed = image.trim();
  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  return `/destino_inicial/${trimmed}`;
};

export const normalizeDestinoInicial = (raw: unknown): DestinoInicialItem | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const item = raw as Partial<DestinoInicialItem> & Record<string, unknown>;
  const fuerza = toNumber(item.fuerza);
  const agilidad = toNumber(item.agilidad);
  const carisma = toNumber(item.carisma);
  const suerte = toNumber(item.suerte);
  const oro = toNumber(item.oro);
  const experiencia = toNumber(item.experiencia);
  const reputacion = toNumber(item.reputacion);

  if (
    typeof item.id !== "string" ||
    item.id.trim().length === 0 ||
    typeof item.name !== "string" ||
    item.name.trim().length === 0 ||
    typeof item.description !== "string" ||
    item.description.trim().length === 0 ||
    fuerza === null ||
    agilidad === null ||
    carisma === null ||
    suerte === null ||
    oro === null ||
    experiencia === null ||
    reputacion === null
  ) {
    return null;
  }

  return {
    id: item.id.trim(),
    name: item.name.trim(),
    description: item.description.trim(),
    fuerza: Math.round(fuerza),
    agilidad: Math.round(agilidad),
    carisma: Math.round(carisma),
    suerte: Math.round(suerte),
    oro: Math.max(0, Math.round(oro)),
    experiencia: Math.max(0, Math.round(experiencia)),
    reputacion: Math.round(reputacion),
    image: normalizeDestinoImagePath(typeof item.image === "string" ? item.image : undefined)
  };
};

export const getLocalDestinoInicial = (): DestinoInicialItem[] =>
  (localDestinoCatalog as unknown[])
    .map(normalizeDestinoInicial)
    .filter((item): item is DestinoInicialItem => item !== null);

export const fetchDestinoInicial = async (): Promise<DestinoInicialItem[]> => {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return getLocalDestinoInicial();
  }

  const { data, error } = await supabase
    .from("destino_inicial")
    .select("iddestino, nombre, descripcion, fuerza, agilidad, carisma, suerte, oro, experiencia, reputacion, imagen")
    .order("nombre");

  if (error || !data) {
    return getLocalDestinoInicial();
  }

  type DestinoInicialRow = {
    iddestino: number | string;
    nombre: string;
    descripcion: string;
    fuerza: number;
    agilidad: number;
    carisma: number;
    suerte: number;
    oro: number;
    experiencia: number;
    reputacion: number;
    imagen: string | null;
  };

  const normalized = (data as DestinoInicialRow[])
    .map((row) =>
      normalizeDestinoInicial({
        id: String(row.iddestino),
        name: row.nombre,
        description: row.descripcion,
        fuerza: row.fuerza,
        agilidad: row.agilidad,
        carisma: row.carisma,
        suerte: row.suerte,
        oro: row.oro,
        experiencia: row.experiencia,
        reputacion: row.reputacion,
        image: row.imagen
      })
    )
    .filter((item): item is DestinoInicialItem => item !== null);

  return normalized.length > 0 ? normalized : getLocalDestinoInicial();
};

export const pickRandomDestinos = (
  items: DestinoInicialItem[],
  count = 3
): DestinoInicialItem[] => {
  if (items.length <= count) {
    return [...items];
  }

  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled.slice(0, Math.max(1, count));
};

export const warmupDestinoInicialCatalog = async (): Promise<void> => {
  try {
    await fetchDestinoInicial();
  } catch {
    // No bloqueamos la creacion de personaje si falla la precarga.
  }
};
