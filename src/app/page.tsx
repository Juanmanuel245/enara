"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Crown, Shield } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  applyDestinoInicialToProfile,
  DEFAULT_ENERGIA,
  DEFAULT_HERO_AGE,
  DEFAULT_HERO_LEVEL,
  DEFAULT_REPUTATION_RANK,
  createInitialEquipment,
  createInitialStats,
  createInitialInventory,
  createInitialSecondaryStats,
  formatEquipmentSlotLabel,
  getReputationRankName,
  GAME_STORAGE_KEY,
  PLAYER_STORAGE_KEY,
  type PlayerProfile,
  parseStoredPlayer
} from "@/lib/player";
import { warmupItemCatalog, getLocalItems } from "@/lib/items";
import { calcHeroAttackPower, getCombatGearFromEquipment } from "@/lib/combat";
import {
  fetchDestinoInicial,
  pickRandomDestinos,
  warmupDestinoInicialCatalog,
  type DestinoInicialItem
} from "@/lib/destino_inicial";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [destinoChoices, setDestinoChoices] = useState<DestinoInicialItem[]>([]);
  const [selectedDestinoId, setSelectedDestinoId] = useState("");
  const [isLoadingDestinos, setIsLoadingDestinos] = useState(true);
  const [savedPlayer, setSavedPlayer] = useState<PlayerProfile | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const player = parseStoredPlayer(window.localStorage.getItem(PLAYER_STORAGE_KEY));
    if (!player) {
      window.localStorage.removeItem(PLAYER_STORAGE_KEY);
    }

    return player;
  });
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadDestinos = async () => {
      setIsLoadingDestinos(true);
      const catalog = await fetchDestinoInicial();
      if (!isMounted) {
        return;
      }

      const randomChoices = pickRandomDestinos(catalog, 3);
      setDestinoChoices(randomChoices);
      setSelectedDestinoId((current) => {
        if (current && randomChoices.some((item) => item.id === current)) {
          return current;
        }
        return randomChoices[0]?.id ?? "";
      });
      setIsLoadingDestinos(false);
    };

    void loadDestinos();

    return () => {
      isMounted = false;
    };
  }, []);

  const createdDate = useMemo(() => {
    if (!savedPlayer?.createdAt) {
      return "";
    }

    return new Date(savedPlayer.createdAt).toLocaleDateString("es-AR", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }, [savedPlayer]);

  const selectedDestino = useMemo(
    () => destinoChoices.find((item) => item.id === selectedDestinoId) ?? null,
    [destinoChoices, selectedDestinoId]
  );

  const savedPlayerAttackPower = useMemo(() => {
    if (!savedPlayer) {
      return 0;
    }

    const gear = getCombatGearFromEquipment(savedPlayer, getLocalItems());
    return calcHeroAttackPower(savedPlayer, gear.weaponDano);
  }, [savedPlayer]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanedName = name.trim();

    if (cleanedName.length < 2) {
      setStatusMessage("Elegi un nombre con al menos 2 caracteres.");
      return;
    }
    if (!selectedDestino) {
      setStatusMessage("Elegi un destino inicial para empezar la partida.");
      return;
    }

    const basePlayer: PlayerProfile = {
      name: cleanedName,
      createdAt: new Date().toISOString(),
      stats: createInitialStats(),
      age: DEFAULT_HERO_AGE,
      coins: 0,
      energia: DEFAULT_ENERGIA,
      nivel: DEFAULT_HERO_LEVEL,
      experiencia: 0,
      reputacionNivel: DEFAULT_REPUTATION_RANK,
      equipment: createInitialEquipment(),
      inventory: createInitialInventory(),
      secondaryStats: createInitialSecondaryStats()
    };
    const player = applyDestinoInicialToProfile(basePlayer, selectedDestino);

    window.localStorage.removeItem(GAME_STORAGE_KEY);
    window.localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(player));
    setSavedPlayer(player);
    setName("");
    await warmupDestinoInicialCatalog();
    await warmupItemCatalog();
    setStatusMessage(
      `El aventurero ${cleanedName} esta listo para comenzar su leyenda como ${selectedDestino.name}.`
    );
    router.push("/juego");
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-stone-950 p-6">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-amber-950/25 via-stone-950 to-stone-950" />
      <div className="pointer-events-none absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-felt.png')] opacity-[0.07]" />

      <Card className="relative z-10 w-full max-w-6xl border-amber-700/30 bg-stone-950/90 backdrop-blur-md">
        <CardHeader className="space-y-4">
          <div className="flex items-center gap-3 text-amber-300">
            <Crown className="h-6 w-6" />
            <p className="font-[var(--font-cinzel)] text-sm uppercase tracking-[0.3em] text-amber-300/80">
              Cronicas de Enara
            </p>
          </div>
          <CardTitle className="font-[var(--font-cinzel)] text-3xl text-amber-100">
            Comenza tu travesia
          </CardTitle>
          <CardDescription className="text-stone-300">
            Sos una persona comun que busca convertirse en leyenda. Tu historia se definira por tarjetas
            de decision que cambiaran tus stats y habilidades.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="character-name" className="text-stone-200">
                Nombre del personaje
              </Label>
              <Input
                id="character-name"
                placeholder="Ej: Aldric, Miriel, Kael..."
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="space-y-3">
              <Label className="text-stone-200">Elegi tu destino inicial</Label>
              <div className="grid gap-5 md:grid-cols-3">
                {destinoChoices.map((destino) => {
                  const isSelected = selectedDestinoId === destino.id;
                  return (
                    <button
                      key={destino.id}
                      type="button"
                      onClick={() => setSelectedDestinoId(destino.id)}
                      className={`rounded-xl border p-5 text-left transition ${
                        isSelected
                          ? "border-amber-400 bg-amber-400/10 shadow-[0_0_0_1px_rgba(251,191,36,0.35)]"
                          : "border-amber-900/40 bg-stone-900/80 hover:border-amber-700/60"
                      }`}
                    >
                      {destino.image ? (
                        <img
                          src={destino.image}
                          alt={destino.name}
                          className="mb-4 h-80 w-full rounded-lg bg-stone-950/85 object-contain p-1.5"
                        />
                      ) : null}
                      <p className="text-sm leading-relaxed text-stone-300">{destino.description}</p>
                    </button>
                  );
                })}
              </div>
              {isLoadingDestinos && (
                <p className="text-xs text-stone-400">Cargando destinos iniciales...</p>
              )}
              {!isLoadingDestinos && destinoChoices.length === 0 && (
                <p className="text-xs text-rose-300">
                  No se pudieron cargar destinos iniciales. Revisa los datos y recarga la pagina.
                </p>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full font-semibold"
              disabled={isLoadingDestinos || destinoChoices.length === 0}
            >
              Forjar destino
            </Button>
          </form>

          {statusMessage && (
            <p className="rounded-md border border-amber-500/30 bg-amber-400/10 p-3 text-sm text-amber-200">
              {statusMessage}
            </p>
          )}

          {savedPlayer && (
            <section className="rounded-lg border border-amber-700/30 bg-amber-950/30 p-4 text-sm text-stone-100">
              <p className="mb-2 flex items-center gap-2 font-[var(--font-cinzel)] text-amber-200">
                <Shield className="h-4 w-4" />
                Personaje guardado
              </p>
              <p>
                <span className="text-stone-400">Nombre:</span> {savedPlayer.name}
              </p>
              <p>
                <span className="text-stone-400">Creado:</span> {createdDate}
              </p>
              <p>
                <span className="text-stone-400">Destino inicial:</span>{" "}
                {savedPlayer.destinoInicial?.name ?? "No definido"}
              </p>
              {savedPlayer.stats && (
                <div className="mt-3 grid grid-cols-2 gap-2 rounded-md border border-amber-700/30 bg-stone-900/60 p-3 text-xs">
                  <p>
                    <span className="text-stone-400">Edad:</span> {savedPlayer.age}
                  </p>
                  <p>
                    <span className="text-stone-400">Monedas:</span> {savedPlayer.coins}
                  </p>
                  <p>
                    <span className="text-stone-400">Mano principal:</span>{" "}
                    {formatEquipmentSlotLabel(savedPlayer.equipment.mano_principal)}
                  </p>
                  <p>
                    <span className="text-stone-400">Mano secundaria:</span>{" "}
                    {formatEquipmentSlotLabel(savedPlayer.equipment.mano_secundaria)}
                  </p>
                  <p>
                    <span className="text-stone-400">Fuerza:</span> {savedPlayer.stats.fuerza}
                  </p>
                  <p>
                    <span className="text-stone-400">Carisma:</span> {savedPlayer.stats.carisma}
                  </p>
                  <p>
                    <span className="text-stone-400">Agilidad:</span> {savedPlayer.stats.agilidad}
                  </p>
                  <p>
                    <span className="text-stone-400">Reconocimiento:</span>{" "}
                    {getReputationRankName(savedPlayer.reputacionNivel)}
                  </p>
                  <p>
                    <span className="text-stone-400">Vida:</span> {savedPlayer.stats.vida}
                  </p>
                  <p>
                    <span className="text-stone-400">Daño:</span> {savedPlayerAttackPower}
                  </p>
                  <p>
                    <span className="text-stone-400">Defensa:</span> {savedPlayer.stats.defensa}
                  </p>
                </div>
              )}
              <Button
                type="button"
                variant="secondary"
                className="mt-4 w-full"
                onClick={() => router.push("/juego")}
              >
                Continuar aventura
              </Button>
            </section>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
