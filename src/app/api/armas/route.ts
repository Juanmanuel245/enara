import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { ARMA_SELECT_COLUMNS, mapArmaRowToWeaponJson, normalizeWeaponItem, type ArmaRow } from "@/lib/items";

const ARMAS_FILE_PATH = path.join(process.cwd(), "src", "data", "armas.json");

type ArmasApiSource = "archivo-local" | "supabase" | "sin-config";
type WeaponJson = NonNullable<ReturnType<typeof mapArmaRowToWeaponJson>>;

const parseRows = (payload: unknown): WeaponJson[] | null => {
  if (!Array.isArray(payload)) {
    return null;
  }

  return payload
    .map((row) => normalizeWeaponItem(row))
    .filter((item): item is WeaponJson => item !== null);
};

const readLocalArmas = async (): Promise<WeaponJson[] | null> => {
  try {
    const raw = await readFile(ARMAS_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parseRows(parsed);
  } catch {
    return null;
  }
};

const hasSupabaseConfig = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const fetchArmasFromSupabase = async (): Promise<WeaponJson[]> => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return [];
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.from("armas").select(ARMA_SELECT_COLUMNS).order("idarma", { ascending: true });

  if (error || !data) {
    return [];
  }

  return (data as ArmaRow[])
    .map(mapArmaRowToWeaponJson)
    .filter((item): item is WeaponJson => item !== null);
};

const writeLocalArmas = async (rows: WeaponJson[]) => {
  const directoryPath = path.dirname(ARMAS_FILE_PATH);
  await mkdir(directoryPath, { recursive: true });
  await writeFile(ARMAS_FILE_PATH, JSON.stringify(rows, null, 2), "utf8");
};

const getArmasDataset = async (): Promise<{ source: ArmasApiSource; rows: WeaponJson[] }> => {
  const localRows = await readLocalArmas();
  if (localRows && localRows.length > 0) {
    return { source: "archivo-local", rows: localRows };
  }

  if (!hasSupabaseConfig()) {
    return { source: "sin-config", rows: [] };
  }

  const remoteRows = await fetchArmasFromSupabase();
  if (remoteRows.length > 0) {
    await writeLocalArmas(remoteRows);
    return { source: "supabase", rows: remoteRows };
  }

  return { source: "sin-config", rows: [] };
};

export const runtime = "nodejs";

export async function GET() {
  try {
    const dataset = await getArmasDataset();
    return NextResponse.json(
      {
        source: dataset.source,
        items: dataset.rows
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ source: "sin-config", items: [] }, { status: 200 });
  }
}
