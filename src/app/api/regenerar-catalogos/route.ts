import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { ARMA_SELECT_COLUMNS, mapArmaRowToWeaponJson, type ArmaRow } from "@/lib/items";
import { normalizeDestinoInicial } from "@/lib/destino_inicial";
import { MISION_SELECT_COLUMNS, mapMisionRowToMissionJson, type MisionRow } from "@/lib/misiones";

export const runtime = "nodejs";

const DATA_DIR = path.join(process.cwd(), "src", "data");
const ARMAS_FILE_PATH = path.join(DATA_DIR, "armas.json");
const DESTINO_FILE_PATH = path.join(DATA_DIR, "destino_inicial.json");
const MISIONES_FILE_PATH = path.join(DATA_DIR, "misiones.json");

type CatalogResult = {
  file: string;
  count: number;
  status: "ok" | "error";
  error?: string;
};

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

const hasSupabaseConfig = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const getSupabaseServerClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey);
};

const recreateJsonFile = async (filePath: string, payload: unknown) => {
  await mkdir(path.dirname(filePath), { recursive: true });

  try {
    await unlink(filePath);
  } catch {
    // Si no existe, seguimos y lo creamos de cero.
  }

  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
};

const emptyCatalogMessage =
  "Supabase respondio sin filas. Revisa RLS/policies de lectura para anon (ver supabase/rls_catalogos.sql).";

const mapDestinoRow = (row: DestinoInicialRow) =>
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
  });

const syncWeaponsCatalog = async (): Promise<CatalogResult> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      file: "armas.json",
      count: 0,
      status: "error",
      error: "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY."
    };
  }

  const { data, error } = await supabase
    .from("armas")
    .select(ARMA_SELECT_COLUMNS)
    .order("idarma", { ascending: true });

  if (error) {
    return {
      file: "armas.json",
      count: 0,
      status: "error",
      error: error.message
    };
  }

  const rows = (data ?? []) as ArmaRow[];
  const payload = rows.map(mapArmaRowToWeaponJson).filter((item): item is NonNullable<typeof item> => item !== null);

  if (payload.length === 0) {
    return {
      file: "armas.json",
      count: 0,
      status: "error",
      error: emptyCatalogMessage
    };
  }

  await recreateJsonFile(ARMAS_FILE_PATH, payload);

  return {
    file: "armas.json",
    count: payload.length,
    status: "ok"
  };
};

const syncDestinoInicialCatalog = async (): Promise<CatalogResult> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      file: "destino_inicial.json",
      count: 0,
      status: "error",
      error: "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY."
    };
  }

  const { data, error } = await supabase
    .from("destino_inicial")
    .select("iddestino, nombre, descripcion, fuerza, agilidad, carisma, suerte, oro, experiencia, reputacion, imagen")
    .order("nombre");

  if (error) {
    return {
      file: "destino_inicial.json",
      count: 0,
      status: "error",
      error: error.message
    };
  }

  const rows = (data ?? []) as DestinoInicialRow[];
  const payload = rows.map(mapDestinoRow).filter((item): item is NonNullable<typeof item> => item !== null);

  if (payload.length === 0) {
    return {
      file: "destino_inicial.json",
      count: 0,
      status: "error",
      error: emptyCatalogMessage
    };
  }

  await recreateJsonFile(DESTINO_FILE_PATH, payload);

  return {
    file: "destino_inicial.json",
    count: payload.length,
    status: "ok"
  };
};

const syncMisionesCatalog = async (): Promise<CatalogResult> => {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return {
      file: "misiones.json",
      count: 0,
      status: "error",
      error: "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY."
    };
  }

  const { data, error } = await supabase.from("misiones").select(MISION_SELECT_COLUMNS).order("idmision", { ascending: true });
  if (error) {
    return {
      file: "misiones.json",
      count: 0,
      status: "error",
      error: error.message
    };
  }

  const rows = (data ?? []) as MisionRow[];
  const payload = rows.map(mapMisionRowToMissionJson).filter((item): item is NonNullable<typeof item> => item !== null);

  if (payload.length === 0) {
    return {
      file: "misiones.json",
      count: 0,
      status: "error",
      error: emptyCatalogMessage
    };
  }

  await recreateJsonFile(MISIONES_FILE_PATH, payload);

  return {
    file: "misiones.json",
    count: payload.length,
    status: "ok"
  };
};

export async function GET() {
  try {
    if (!hasSupabaseConfig()) {
      return NextResponse.json(
        {
          ok: false,
          message: "Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.",
          results: {
            armas: {
              file: "armas.json",
              count: 0,
              status: "error",
              error: "Sin configuracion de Supabase."
            },
            destino_inicial: {
              file: "destino_inicial.json",
              count: 0,
              status: "error",
              error: "Sin configuracion de Supabase."
            },
            misiones: {
              file: "misiones.json",
              count: 0,
              status: "error",
              error: "Sin configuracion de Supabase."
            }
          }
        },
        { status: 500 }
      );
    }

    const itemsWeapons = await syncWeaponsCatalog();
    const destinoInicial = await syncDestinoInicialCatalog();
    const misiones = await syncMisionesCatalog();
    const ok = itemsWeapons.status === "ok" && destinoInicial.status === "ok" && misiones.status === "ok";

    return NextResponse.json(
      {
        ok,
        message: ok
          ? "Catalogos regenerados desde Supabase."
          : "Hubo errores regenerando uno o mas catalogos.",
        results: {
          armas: itemsWeapons,
          destino_inicial: destinoInicial,
          misiones
        }
      },
      { status: ok ? 200 : 500 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: "Error inesperado regenerando catalogos.",
        error: error instanceof Error ? error.message : "Error desconocido"
      },
      { status: 500 }
    );
  }
}
