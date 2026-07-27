import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const ITEMS_DIR = path.join(ROOT, "public", "items");

const TIPO_SLOT = {
  hacha: "mano_principal",
  espada: "mano_principal",
  lanza: "mano_principal",
  maza: "mano_principal",
  daga: "mano_secundaria",
  orbe: "mano_secundaria",
  escudo: "mano_secundaria",
  cinturon: "cinturon",
  casco: "casco",
  pechera: "pechera",
  pantalon: "pantalon",
  bota: "botas",
  guante: "guantes",
  hombrera: "hombrera",
  capa: "capa",
  brazalete: "brazaletes"
};

const RARITY_BY_TIER = ["Comun", "Comun", "Poco comun", "Poco comun", "Rara", "Rara", "Epica", "Epica", "Legendaria", "Legendaria", "Legendaria", "Legendaria", "Legendaria", "Legendaria"];

const SPECIAL_RARITY = {
  maldit: "Legendaria",
  maldita: "Legendaria",
  maldito: "Legendaria",
  malditas: "Legendaria",
  malditos: "Legendaria",
  fuego: "Epica",
  hielo: "Epica",
  sagrad: "Legendaria",
  celestial: "Legendaria",
  arcana: "Legendaria",
  runic: "Epica",
  dragon: "Rara",
  campeon: "Rara",
  asesino: "Rara",
  vacio: "Epica"
};

const formatName = (filename, tipo) => {
  const base = filename.replace(/^\d+_/, "").replace(/\.png$/i, "");
  const words = base.split("_").filter(Boolean);
  const tipoWord = tipo.replace(/_/g, " ");
  const normalized = words.join(" ");
  if (normalized.toLowerCase().includes(tipoWord.toLowerCase())) {
    return normalized
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
  return `${normalized
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")}`.trim();
};

const inferRarity = (filename, tier) => {
  const lower = filename.toLowerCase();
  for (const [keyword, rarity] of Object.entries(SPECIAL_RARITY)) {
    if (lower.includes(keyword)) {
      return rarity;
    }
  }
  return RARITY_BY_TIER[Math.min(tier - 1, RARITY_BY_TIER.length - 1)] ?? "Comun";
};

const inferStats = (tipo, tier, filename) => {
  const lower = filename.toLowerCase();
  const isWeapon = ["hacha", "espada", "lanza", "maza", "daga"].includes(tipo);
  const isShield = tipo === "escudo" || tipo === "orbe";
  const isArmor = !isWeapon && !isShield;

  let ataque = isWeapon ? tier : isShield && tipo === "orbe" ? Math.max(0, tier - 1) : 0;
  let defensa = isShield ? tier + 1 : isArmor ? Math.max(1, tier) : Math.max(0, Math.floor(tier / 3));
  let agilidad = isWeapon ? Math.max(0, Math.floor(tier / 2)) : isArmor && ["capa", "bota", "guante"].includes(tipo) ? Math.max(0, Math.floor(tier / 2)) : 0;
  let salud = isArmor ? tier * 2 : 0;

  if (lower.includes("maldit")) {
    salud = -Math.max(3, tier * 2);
    defensa = Math.max(0, defensa - 1);
  }
  if (lower.includes("fuego")) {
    ataque += 2;
  }
  if (lower.includes("hielo")) {
    defensa += 2;
  }
  if (lower.includes("sagrad") || lower.includes("celestial")) {
    salud += 5;
    defensa += 1;
  }

  return { ataque, defensa, agilidad, salud };
};

const inferEconomy = (tier, rarity) => {
  const rarityMultiplier = {
    Comun: 1,
    "Poco comun": 1.4,
    Rara: 2,
    Epica: 3.5,
    Legendaria: 8
  };
  const mult = rarityMultiplier[rarity] ?? 1;
  const valor = Math.round((40 + tier * 35) * mult);
  const drop = tier <= 2 ? Math.max(8, 16 - tier * 2) : tier <= 4 ? Math.max(5, 10 - tier) : tier <= 6 ? 4 : 2;
  return { valor, drop: Math.min(50, drop) };
};

const shouldSell = (tier, rarity) => tier <= 6 && rarity !== "Legendaria";

const collectImages = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const lower = entry.name.toLowerCase();
      if (lower.includes("sin uso") || lower.includes("sin_uso")) {
        continue;
      }
      files.push(...(await collectImages(fullPath)));
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".png")) {
      files.push(fullPath);
    }
  }

  return files;
};

const FALLBACK_IMAGE_PATHS = [
  "hacha/01_hacha_simple.png",
  "hacha/02_hacha_oxidada.png",
  "hacha/03_hacha_madera.png",
  "hacha/04_hacha_hierro.png",
  "hacha/05_hacha_barbara.png",
  "hacha/06_hacha_maldita.png",
  "hacha/07_hacha_de_fuego.png",
  "hacha/08_hacha_de_hielo.png",
  "hacha/09_hacha_arcana.png",
  "espada/01_espada_daniada.png",
  "espada/02_espada_bronce.png",
  "espada/03_espada_hierro.png",
  "espada/04_espada_hierro_negro.png",
  "espada/05_espada_huesos.png",
  "espada/06_espada_fuego.png",
  "espada/07_espada_hielo.png",
  "espada/08_espada_runica.png",
  "daga/01_daga_comun.png",
  "daga/02_daga_de_hierro.png",
  "daga/03_daga_curva.png",
  "daga/04_daga_de_plata.png",
  "daga/05_daga_del_asesino.png",
  "daga/06_daga_de_hielo.png",
  "daga/07_daga_de_fuego.png",
  "lanza/01_lanza_hierro.png",
  "lanza/02_lanza_barbara.png",
  "lanza/03_lanza_campeon.png",
  "lanza/04_lanza_dragon.png",
  "lanza/05_lanza_sagrada.png",
  "maza/01_maza_madera.png",
  "maza/02_maza_con_pinchos.png",
  "maza/03_maza_bronce.png",
  "maza/04_maza_hierro.png",
  "maza/05_maza_acero.png",
  "maza/06_maza_pesada.png",
  "maza/07_maza_de_hielo.png",
  "maza/08_maza_arcana.png",
  "orbe/01_orbe_vidrio.png",
  "orbe/02_orbe_sangre.png",
  "orbe/03_orbe_arcana.png",
  "orbe/04_orbe_fuego.png",
  "orbe/05_orbe_hielo.png",
  "orbe/06_orbe_vacio.png"
];

const buildCatalog = async () => {
  const scannedImages = await collectImages(ITEMS_DIR);
  const scannedRelative = scannedImages.map((fullPath) => path.relative(ITEMS_DIR, fullPath).replace(/\\/g, "/"));
  const allRelative = [...new Set([...scannedRelative, ...FALLBACK_IMAGE_PATHS])];
  const sorted = allRelative
    .map((relative) => {
      const [tipo, filename] = relative.split("/");
      const match = filename.match(/^(\d+)_/);
      const tier = match ? Number.parseInt(match[1], 10) : 99;
      return { relative, tipo, filename, tier };
    })
    .filter((entry) => TIPO_SLOT[entry.tipo])
    .sort((a, b) => {
      if (a.tipo !== b.tipo) {
        return a.tipo.localeCompare(b.tipo);
      }
      return a.tier - b.tier;
    });

  return sorted.map((entry, index) => {
    const slot = TIPO_SLOT[entry.tipo];
    const rarity = inferRarity(entry.filename, entry.tier);
    const stats = inferStats(entry.tipo, entry.tier, entry.filename);
    const economy = inferEconomy(entry.tier, rarity);
    const nivelMinimo = Math.max(1, Math.ceil(entry.tier / 2));
    const imagen = `${entry.tipo}/${entry.filename}`;

    return {
      id: index + 1,
      nombre: formatName(entry.filename, entry.tipo),
      valor: economy.valor,
      drop: economy.drop,
      is_dropping: true,
      is_selling: shouldSell(entry.tier, rarity),
      imagen,
      slot,
      ataque: stats.ataque,
      defensa: stats.defensa,
      agilidad: stats.agilidad,
      salud: stats.salud,
      rareza: rarity,
      tipo: entry.tipo,
      ovr: entry.tier * 10,
      nivel_minimo: nivelMinimo,
      is_crafting: false,
      nombre_archivo: entry.filename
    };
  });
};

const toJsonCatalog = (rows) =>
  rows.map((row) => ({
    id: String(row.id),
    name: row.nombre,
    slot: row.slot,
    rarity: row.rareza,
    cost: row.valor,
    image: row.imagen,
    effects: {
      ...(row.ataque ? { dano: row.ataque } : {}),
      ...(row.defensa ? { defensa: row.defensa } : {}),
      ...(row.agilidad ? { agilidad: row.agilidad } : {}),
      ...(row.salud ? { vida: row.salud } : {})
    },
    dropRatePercent: row.drop,
    isDropping: row.is_dropping,
    isSelling: row.is_selling,
    nivel: row.nivel_minimo,
    tipo: row.tipo,
    ovr: row.ovr,
    isCrafting: row.is_crafting,
    nombreArchivo: row.nombre_archivo
  }));

const toSql = (rows) => {
  const values = rows
    .map((row) => {
      const cols = [
        row.id,
        `'${row.nombre.replace(/'/g, "''")}'`,
        row.valor,
        row.drop,
        row.is_dropping,
        row.is_selling,
        `'${row.imagen.replace(/'/g, "''")}'`,
        `'${row.slot}'`,
        row.ataque,
        row.defensa,
        row.agilidad,
        row.salud,
        `'${row.rareza.replace(/'/g, "''")}'`,
        `'${row.tipo}'`,
        row.ovr,
        row.nivel_minimo,
        row.is_crafting,
        `'${row.nombre_archivo.replace(/'/g, "''")}'`
      ];
      return `  (${cols.join(", ")})`;
    })
    .join(",\n");

  return `-- Catalogo unificado de items equipables.
-- Regenerado con scripts/generate-items-catalog.mjs

create table if not exists public.items (
  id bigint generated by default as identity not null,
  nombre text null,
  valor numeric null,
  drop numeric null,
  is_dropping boolean null,
  is_selling boolean null,
  imagen text null,
  slot text null,
  created_at timestamp with time zone not null default now(),
  ataque numeric not null default '0'::numeric,
  defensa numeric not null default '0'::numeric,
  agilidad numeric not null default '0'::numeric,
  salud numeric not null default '0'::numeric,
  rareza text null,
  tipo text null,
  ovr numeric null,
  nivel_minimo numeric null,
  is_crafting boolean null,
  nombre_archivo text null,
  constraint items_pkey primary key (id)
) tablespace pg_default;

alter table public.items enable row level security;

drop policy if exists "public can read items" on public.items;
create policy "public can read items"
on public.items
for select
to anon, authenticated
using (true);

truncate table public.items restart identity;

insert into public.items (
  id,
  nombre,
  valor,
  drop,
  is_dropping,
  is_selling,
  imagen,
  slot,
  ataque,
  defensa,
  agilidad,
  salud,
  rareza,
  tipo,
  ovr,
  nivel_minimo,
  is_crafting,
  nombre_archivo
)
values
${values}
on conflict (id) do update set
  nombre = excluded.nombre,
  valor = excluded.valor,
  drop = excluded.drop,
  is_dropping = excluded.is_dropping,
  is_selling = excluded.is_selling,
  imagen = excluded.imagen,
  slot = excluded.slot,
  ataque = excluded.ataque,
  defensa = excluded.defensa,
  agilidad = excluded.agilidad,
  salud = excluded.salud,
  rareza = excluded.rareza,
  tipo = excluded.tipo,
  ovr = excluded.ovr,
  nivel_minimo = excluded.nivel_minimo,
  is_crafting = excluded.is_crafting,
  nombre_archivo = excluded.nombre_archivo;
`;
};

const main = async () => {
  const rows = await buildCatalog();
  const jsonPath = path.join(ROOT, "src", "data", "items.json");
  const sqlPath = path.join(ROOT, "supabase", "items.sql");

  await writeFile(jsonPath, `${JSON.stringify(toJsonCatalog(rows), null, 2)}\n`, "utf8");
  await writeFile(sqlPath, `${toSql(rows)}\n`, "utf8");

  console.log(`Generated ${rows.length} items -> ${jsonPath}`);
  console.log(`Generated SQL seed -> ${sqlPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
