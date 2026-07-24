import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  MISION_SELECT_COLUMNS,
  mapMisionRowToMissionJson,
  normalizeMission,
  type MisionRow
} from "@/lib/misiones";

const MISIONES_FILE_PATH = path.join(process.cwd(), "src", "data", "misiones.json");

type MisionesApiSource = "archivo-local" | "supabase" | "sin-config";

type MissionJson = NonNullable<ReturnType<typeof mapMisionRowToMissionJson>>;

const parseRows = (payload: unknown): MissionJson[] | null => {
  if (!Array.isArray(payload)) {
    return null;
  }

  return payload
    .map((row) => normalizeMission(row))
    .filter((mission): mission is MissionJson => mission !== null);
};

const readLocalMisiones = async (): Promise<MissionJson[] | null> => {
  try {
    const raw = await readFile(MISIONES_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parseRows(parsed);
  } catch {
    return null;
  }
};

const hasSupabaseConfig = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const writeLocalMisiones = async (rows: MissionJson[]) => {
  const directoryPath = path.dirname(MISIONES_FILE_PATH);
  await mkdir(directoryPath, { recursive: true });
  await writeFile(MISIONES_FILE_PATH, JSON.stringify(rows, null, 2), "utf8");
};

const getMisionesDataset = async (): Promise<{ source: MisionesApiSource; items: MissionJson[]; error?: string }> => {
  const localRows = await readLocalMisiones();
  if (localRows && localRows.length > 0) {
    return { source: "archivo-local", items: localRows };
  }

  if (!hasSupabaseConfig()) {
    return {
      source: "sin-config",
      items: [],
      error: "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY."
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.from("misiones").select(MISION_SELECT_COLUMNS).order("idmision", { ascending: true });

  if (error) {
    return { source: "sin-config", items: [], error: error.message };
  }

  const remoteRows = (data ?? [])
    .map((row) => mapMisionRowToMissionJson(row as MisionRow))
    .filter((mission): mission is MissionJson => mission !== null);

  if (remoteRows.length > 0) {
    await writeLocalMisiones(remoteRows);
    return { source: "supabase", items: remoteRows };
  }

  return {
    source: "sin-config",
    items: [],
    error: "La tabla misiones respondio sin filas. Revisa RLS/policies (ver supabase/rls_catalogos.sql)."
  };
};

export const runtime = "nodejs";

export async function GET() {
  try {
    const dataset = await getMisionesDataset();
    return NextResponse.json(
      {
        source: dataset.source,
        items: dataset.items,
        error: dataset.error
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ source: "sin-config", items: [] }, { status: 200 });
  }
}
