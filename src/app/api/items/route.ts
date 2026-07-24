import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { ITEM_SELECT_COLUMNS, mapItemRowToJson, normalizeGameItem, type ItemRow } from "@/lib/items";

const ITEMS_FILE_PATH = path.join(process.cwd(), "src", "data", "items.json");

type ItemsApiSource = "archivo-local" | "supabase" | "sin-config";
type ItemJson = NonNullable<ReturnType<typeof mapItemRowToJson>>;

const parseRows = (payload: unknown): ItemJson[] | null => {
  if (!Array.isArray(payload)) {
    return null;
  }

  return payload.map((row) => normalizeGameItem(row)).filter((item): item is ItemJson => item !== null);
};

const readLocalItems = async (): Promise<ItemJson[] | null> => {
  try {
    const raw = await readFile(ITEMS_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parseRows(parsed);
  } catch {
    return null;
  }
};

const hasSupabaseConfig = () => Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const fetchItemsFromSupabase = async (): Promise<ItemJson[]> => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return [];
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data, error } = await supabase.from("items").select(ITEM_SELECT_COLUMNS).order("id", { ascending: true });

  if (error || !data) {
    return [];
  }

  return (data as ItemRow[])
    .map(mapItemRowToJson)
    .filter((item): item is ItemJson => item !== null);
};

const writeLocalItems = async (rows: ItemJson[]) => {
  const directoryPath = path.dirname(ITEMS_FILE_PATH);
  await mkdir(directoryPath, { recursive: true });
  await writeFile(ITEMS_FILE_PATH, JSON.stringify(rows, null, 2), "utf8");
};

const getItemsDataset = async (): Promise<{ source: ItemsApiSource; rows: ItemJson[] }> => {
  const localRows = await readLocalItems();
  if (localRows && localRows.length > 0) {
    return { source: "archivo-local", rows: localRows };
  }

  if (!hasSupabaseConfig()) {
    return { source: "sin-config", rows: [] };
  }

  const remoteRows = await fetchItemsFromSupabase();
  if (remoteRows.length > 0) {
    await writeLocalItems(remoteRows);
    return { source: "supabase", rows: remoteRows };
  }

  return { source: "sin-config", rows: [] };
};

export const runtime = "nodejs";

export async function GET() {
  try {
    const dataset = await getItemsDataset();
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
