"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Coins,
  Clover,
  Footprints,
  HeartPulse,
  Moon,
  Crosshair,
  Flame,
  MessageCircle,
  Send,
  Shield,
  ShieldHalf,
  Sun,
  Sunset,
  Wind,
  Sparkles,
  Skull,
  Sword,
  Swords,
  Trophy,
  Users,
  X,
  Zap
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  calculateFinalScore,
  createInitialCampaignStats,
  getRetirementMessage,
  normalizeCampaignStats,
  submitPuntaje,
  type CampaignStats,
  type RetirementReason
} from "@/lib/campaign";
import {
  buildPersonalScoreShareText,
  shareViaTelegram,
  shareViaWhatsApp
} from "@/lib/share";
import {
  fetchItems,
  findItemById,
  getLocalItems,
  isConsumableItem,
  normalizeGameItem,
  rollDroppedItem,
  type GameItem
} from "@/lib/items";
import {
  fetchMissions,
  filterEligibleMissions,
  getLocalMissions,
  splitMissionsByType,
  type Mission,
  type MissionOption
} from "@/lib/misiones";
import {
  applyVictoryRewards,
  calcHeroAttackPower,
  createCombatState,
  getCombatGearFromEquipment,
  getEffectiveHeroStats,
  resolveCombatTurn,
  type CombatAction,
  type CombatState
} from "@/lib/combat";
import {
  getEncounterChoiceLabel,
  getLocalEnemigos,
  normalizeEnemigo,
  pickRandomEnemigoForEncounter,
  resolveEnemigoImagen,
  type DayStage3EncounterChoice,
  type Enemigo
} from "@/lib/enemigos";
import {
  applyReputationGain,
  addItemToInventory,
  buyItemToInventory,
  consumeItemFromInventory,
  equipItemFromInventory,
  EQUIPMENT_LAYOUT,
  getHeroExperienceProgress,
  getHeroLevelXpTable,
  getReputationProgress,
  getReputationRankXpTable,
  migrateLegacyEquipmentIds,
  MAX_ENERGIA,
  MAX_CAMPAIGN_TURNS,
  RETIREMENT_AGE,
  DEFAULT_HERO_AGE,
  GAME_STORAGE_KEY,
  PLAYER_STORAGE_KEY,
  sellItemFromInventoryAt,
  unequipItemToInventory,
  type HeroStats,
  type PlayerProfile,
  parseStoredPlayer
} from "@/lib/player";
import {
  formatCharismaTradeHint,
  getShopBuyPrice,
  getShopSellPrice,
  pickShopOffers
} from "@/lib/shop";

const HERO_LEVEL_XP_TABLE = getHeroLevelXpTable();
const REPUTATION_RANK_XP_TABLE = getReputationRankXpTable();

type Enemy = {
  id: string;
  name: string;
  difficulty: "Facil" | "Media" | "Dificil" | "Elite" | "Jefe";
  vida: number;
  dano: number;
  defensa: number;
  image: string;
};

type LastBattle = {
  missionTitle: string;
  selectedOption: string;
  enemy: Enemy;
  rounds: number;
  heroDamageDone: number;
  enemyDamageDone: number;
  winner: "hero" | "enemy";
  reputationGain: number;
  heroLifeAfter: number;
};

type LastMissionChoice = {
  missionTitle: string;
  missionType: "vida" | "situacion";
  selectedOptionText: string;
  response?: string;
  effects: Partial<Record<keyof HeroStats, number>>;
  energiaSpent?: number;
};

type StageMessage = {
  stage: 1 | 2 | 3;
  text: string;
  recovered?: {
    vida: number;
    energia: number;
  };
  spent?: {
    energia: number;
  };
};

type GamePhase =
  | "lifeMission"
  | "missionResult"
  | "dayStage2"
  | "shop"
  | "dayStage3"
  | "stageMessage"
  | "enemyEncounter"
  | "battle"
  | "finished";

type GameState = {
  turnIndex: number;
  lifeMissionIndex: number;
  situationMissionIndex: number;
  dungeonIndex: number;
  phase: GamePhase;
  player: PlayerProfile;
  lastBattle: LastBattle | null;
  lastMissionChoice: LastMissionChoice | null;
  lastStageMessage: StageMessage | null;
  pendingDrop: GameItem | null;
  pendingEnemy: Enemigo | null;
  pendingEncounterChoice: DayStage3EncounterChoice | null;
  combat: CombatState | null;
  shopOffers: string[];
  campaignStats: CampaignStats;
  retirementReason: RetirementReason | null;
  finalScore: number | null;
  puntajeSubmitted: boolean;
};

const normalizeCombatState = (raw: unknown, enemy: Enemigo | null): CombatState | null => {
  if (!enemy) {
    return null;
  }

  if (!raw || typeof raw !== "object") {
    return createCombatState(enemy);
  }

  const parsed = raw as Partial<CombatState>;
  const enemyVidaMax =
    typeof parsed.enemyVidaMax === "number" && Number.isFinite(parsed.enemyVidaMax)
      ? Math.max(1, Math.round(parsed.enemyVidaMax))
      : enemy.vida;
  const enemyVida =
    typeof parsed.enemyVida === "number" && Number.isFinite(parsed.enemyVida)
      ? clamp(Math.round(parsed.enemyVida), 0, enemyVidaMax)
      : enemy.vida;
  const status =
    parsed.status === "active" ||
    parsed.status === "won" ||
    parsed.status === "lost" ||
    parsed.status === "fled"
      ? parsed.status
      : "active";

  return {
    enemyVida,
    enemyVidaMax,
    log: Array.isArray(parsed.log)
      ? parsed.log.filter((line): line is string => typeof line === "string").slice(-12)
      : createCombatState(enemy).log,
    status,
    rounds: typeof parsed.rounds === "number" ? Math.max(0, Math.round(parsed.rounds)) : 0,
    heroDamageDone:
      typeof parsed.heroDamageDone === "number" ? Math.max(0, Math.round(parsed.heroDamageDone)) : 0,
    enemyDamageDone:
      typeof parsed.enemyDamageDone === "number" ? Math.max(0, Math.round(parsed.enemyDamageDone)) : 0
  };
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const resolveItemImage = (image?: string) => {
  if (!image) {
    return "";
  }
  if (image.startsWith("http") || image.startsWith("/")) {
    return image;
  }
  return `/items/armas/${image}`;
};

const randomBetween = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const getCombatLogClassName = (line: string): string => {
  const lower = line.toLowerCase();

  if (lower.includes("derrotaste") || lower.includes("escapas del combate")) {
    return "text-emerald-400";
  }
  if (lower.includes("fuiste derrotado") || lower.includes("recibis") || lower.includes("te hace")) {
    return "text-red-400";
  }
  if (lower.includes("golpe critico") || lower.includes("infligis") || lower.includes("atacas e")) {
    return "text-lime-300";
  }
  if (lower.includes("esquivas") || lower.includes("bloqueas parte del golpe")) {
    return "text-cyan-300";
  }
  if (
    lower.includes("esquivo") ||
    lower.includes("bloqueo parte") ||
    lower.includes("fallaste la huida")
  ) {
    return "text-amber-400";
  }
  if (lower.includes("te pones en guardia")) {
    return "text-blue-300";
  }
  if (lower.includes("aparece")) {
    return "text-amber-200";
  }

  return "text-stone-200";
};

const statLabels: Record<keyof HeroStats, string> = {
  fuerza: "Fuerza",
  carisma: "Carisma",
  agilidad: "Agilidad",
  suerte: "Suerte",
  reputacion: "Reputacion",
  vida: "Vida",
  vidaMax: "Vida maxima",
  dano: "Daño",
  defensa: "Defensa"
};

const formatMissionEffects = (effects: Partial<Record<keyof HeroStats, number>>) => {
  const entries = (Object.keys(effects) as (keyof HeroStats)[]).filter(
    (key) => typeof effects[key] === "number" && effects[key] !== 0
  );

  if (entries.length === 0) {
    return ["Sin cambios en tus atributos."];
  }

  return entries.map((key) => {
    const value = effects[key] ?? 0;
    const sign = value > 0 ? "+" : "";
    const label = key === "dano" ? statLabels.fuerza : statLabels[key];
    return `${sign}${value} ${label}`;
  });
};

const getItemEffectLines = (effects: Partial<Record<keyof HeroStats, number>>) =>
  (Object.keys(effects) as (keyof HeroStats)[])
    .filter((key) => typeof effects[key] === "number" && (effects[key] ?? 0) !== 0)
    .map((key) => ({
      key,
      value: effects[key] ?? 0,
      label: statLabels[key]
    }));

const applyOptionEffects = (
  player: PlayerProfile,
  effects: Partial<Record<keyof HeroStats, number>>
): PlayerProfile => {
  const next: HeroStats = { ...player.stats };
  const reputationDelta = effects.reputacion ?? 0;

  (Object.keys(effects) as (keyof HeroStats)[]).forEach((key) => {
    if (key === "reputacion") {
      return;
    }
    if (key === "dano") {
      next.fuerza += effects[key] ?? 0;
      return;
    }
    next[key] = next[key] + (effects[key] ?? 0);
  });

  const ranked = applyReputationGain(player.reputacionNivel, player.stats.reputacion, reputationDelta);

  return {
    ...player,
    reputacionNivel: ranked.reputacionNivel,
    stats: {
      fuerza: clamp(next.fuerza, 1, 30),
      carisma: clamp(next.carisma, 1, 30),
      agilidad: clamp(next.agilidad, 1, 30),
      suerte: clamp(next.suerte, 1, 30),
      reputacion: ranked.reputacion,
      vida: clamp(next.vida, 1, next.vidaMax),
      vidaMax: next.vidaMax,
      dano: 0,
      defensa: clamp(next.defensa, 0, 30)
    } satisfies HeroStats
  };
};

const applyRestRecovery = (player: PlayerProfile) => {
  const vidaPercent = randomBetween(5, 20);
  const energiaPercent = randomBetween(25, 70);
  const vidaRecoveredBase = Math.max(1, Math.round((player.stats.vidaMax * vidaPercent) / 100));
  const energiaRecoveredBase = Math.max(1, Math.round((MAX_ENERGIA * energiaPercent) / 100));
  const newVida = clamp(player.stats.vida + vidaRecoveredBase, 1, player.stats.vidaMax);
  const newEnergia = clamp(player.energia + energiaRecoveredBase, 0, MAX_ENERGIA);

  return {
    player: {
      ...player,
      stats: {
        ...player.stats,
        vida: newVida
      },
      energia: newEnergia
    } satisfies PlayerProfile,
    recovered: {
      vida: newVida - player.stats.vida,
      energia: newEnergia - player.energia
    }
  };
};

/** Gasta un porcentaje aleatorio de la energia maxima del heroe. */
const spendEnergyPercent = (player: PlayerProfile, minPercent: number, maxPercent: number) => {
  const energiaPercent = randomBetween(minPercent, maxPercent);
  const energiaSpentBase = Math.max(1, Math.round((MAX_ENERGIA * energiaPercent) / 100));
  const newEnergia = clamp(player.energia - energiaSpentBase, 0, MAX_ENERGIA);

  return {
    player: {
      ...player,
      energia: newEnergia
    } satisfies PlayerProfile,
    spent: player.energia - newEnergia
  };
};


const parseStoredGame = (rawGame: string | null): GameState | null => {
  if (!rawGame) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawGame) as Partial<GameState>;
    if (
      typeof parsed.turnIndex !== "number" ||
      typeof parsed.lifeMissionIndex !== "number" ||
      typeof parsed.situationMissionIndex !== "number" ||
      typeof parsed.dungeonIndex !== "number" ||
      !parsed.player?.name ||
      !parsed.phase
    ) {
      return null;
    }

    const normalizedPlayer = parseStoredPlayer(JSON.stringify(parsed.player));
    if (!normalizedPlayer) {
      return null;
    }

    const normalizePhase = (phase: unknown): GamePhase | null => {
      if (phase === "situationMission") {
        return "dayStage2";
      }

      if (phase === "encounterChoice") {
        return "dayStage3";
      }

      if (
        phase === "lifeMission" ||
        phase === "missionResult" ||
        phase === "dayStage2" ||
        phase === "shop" ||
        phase === "dayStage3" ||
        phase === "stageMessage" ||
        phase === "enemyEncounter" ||
        phase === "battle" ||
        phase === "finished"
      ) {
        return phase;
      }

      return null;
    };

    const normalizedPhase = normalizePhase(parsed.phase);
    if (!normalizedPhase) {
      return null;
    }

    const parsedStageMessage = parsed.lastStageMessage as Partial<StageMessage> | null | undefined;
    const normalizedStageMessage =
      parsedStageMessage &&
      (parsedStageMessage.stage === 1 ||
        parsedStageMessage.stage === 2 ||
        parsedStageMessage.stage === 3) &&
      typeof parsedStageMessage.text === "string"
        ? {
            stage: parsedStageMessage.stage,
            text: parsedStageMessage.text,
            recovered:
              parsedStageMessage.recovered &&
              typeof parsedStageMessage.recovered.vida === "number" &&
              typeof parsedStageMessage.recovered.energia === "number"
                ? {
                    vida: Math.max(0, Math.round(parsedStageMessage.recovered.vida)),
                    energia: Math.max(0, Math.round(parsedStageMessage.recovered.energia))
                  }
                : undefined,
            spent:
              parsedStageMessage.spent && typeof parsedStageMessage.spent.energia === "number"
                ? {
                    energia: Math.max(0, Math.round(parsedStageMessage.spent.energia))
                  }
                : undefined
          }
        : null;

    const parsedEncounterChoice = parsed.pendingEncounterChoice;
    const normalizedEncounterChoice =
      parsedEncounterChoice === "defend" ||
      parsedEncounterChoice === "cave" ||
      parsedEncounterChoice === "dungeon"
        ? parsedEncounterChoice
        : null;

    const pendingEnemy = normalizeEnemigo(parsed.pendingEnemy);
    const shopOffers = Array.isArray(parsed.shopOffers)
      ? parsed.shopOffers.filter((itemId): itemId is string => typeof itemId === "string" && itemId.length > 0)
      : [];

    return {
      turnIndex: parsed.turnIndex,
      lifeMissionIndex: parsed.lifeMissionIndex,
      situationMissionIndex: parsed.situationMissionIndex,
      dungeonIndex: parsed.dungeonIndex,
      phase: normalizedPhase,
      player: normalizedPlayer,
      lastBattle: parsed.lastBattle ?? null,
      lastMissionChoice: parsed.lastMissionChoice ?? null,
      lastStageMessage: normalizedStageMessage,
      pendingDrop: normalizeGameItem(parsed.pendingDrop),
      pendingEnemy,
      pendingEncounterChoice: normalizedEncounterChoice,
      combat:
        normalizedPhase === "enemyEncounter"
          ? normalizeCombatState(parsed.combat, pendingEnemy)
          : null,
      shopOffers: normalizedPhase === "shop" ? shopOffers : [],
      campaignStats: normalizeCampaignStats(parsed.campaignStats, normalizedPlayer.coins),
      retirementReason:
        parsed.retirementReason === "age" ||
        parsed.retirementReason === "death" ||
        parsed.retirementReason === "missions"
          ? parsed.retirementReason
          : null,
      finalScore:
        typeof parsed.finalScore === "number" && Number.isFinite(parsed.finalScore)
          ? Math.round(parsed.finalScore)
          : null,
      puntajeSubmitted: parsed.puntajeSubmitted === true
    } satisfies GameState;
  } catch {
    return null;
  }
};

export default function GamePage() {
  const router = useRouter();
  const combatLogRef = useRef<HTMLUListElement>(null);
  const puntajeSubmitStartedRef = useRef(false);
  const currentLevelRowRef = useRef<HTMLTableRowElement>(null);
  const currentReputationRowRef = useRef<HTMLTableRowElement>(null);
  const [itemCatalog, setItemCatalog] = useState<GameItem[]>(() => getLocalItems());
  const [missionItems, setMissionItems] = useState<Mission[]>(() => getLocalMissions());
  const [enemigoItems] = useState<Enemigo[]>(() => getLocalEnemigos());
  const [levelXpTableOpen, setLevelXpTableOpen] = useState(false);
  const [reputationRankTableOpen, setReputationRankTableOpen] = useState(false);
  const [puntajeSubmitError, setPuntajeSubmitError] = useState<string | null>(null);
  const [game, setGame] = useState<GameState | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const loadedPlayer = parseStoredPlayer(window.localStorage.getItem(PLAYER_STORAGE_KEY));
    if (!loadedPlayer?.stats) {
      window.localStorage.removeItem(PLAYER_STORAGE_KEY);
      window.localStorage.removeItem(GAME_STORAGE_KEY);
      return null;
    }

    const savedGame = parseStoredGame(window.localStorage.getItem(GAME_STORAGE_KEY));
    if (savedGame?.player?.name === loadedPlayer.name) {
      return savedGame;
    }

    return {
      turnIndex: 1,
      lifeMissionIndex: 0,
      situationMissionIndex: 0,
      dungeonIndex: 0,
      phase: "lifeMission",
      player: loadedPlayer,
      lastBattle: null,
      lastMissionChoice: null,
      lastStageMessage: null,
      pendingDrop: null,
      pendingEnemy: null,
      pendingEncounterChoice: null,
      combat: null,
      shopOffers: [],
      campaignStats: createInitialCampaignStats(loadedPlayer.coins),
      retirementReason: null,
      finalScore: null,
      puntajeSubmitted: false
    } satisfies GameState;
  });

  const persistGame = (nextGame: GameState) => {
    setGame(nextGame);
    window.localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(nextGame));
    window.localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(nextGame.player));
  };

  useEffect(() => {
    let active = true;

    const loadItems = async () => {
      const loaded = await fetchItems();
      if (!active) {
        return;
      }

      setItemCatalog(loaded);

      setGame((currentGame) => {
        if (!currentGame) {
          return currentGame;
        }

        const migratedPlayer = migrateLegacyEquipmentIds(currentGame.player, loaded);
        if (migratedPlayer === currentGame.player) {
          return currentGame;
        }

        const nextGame = { ...currentGame, player: migratedPlayer };
        window.localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(nextGame));
        window.localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(migratedPlayer));
        return nextGame;
      });
    };

    void loadItems();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!game || game.phase !== "finished" || game.puntajeSubmitted || game.finalScore === null) {
      return;
    }

    if (puntajeSubmitStartedRef.current) {
      return;
    }

    puntajeSubmitStartedRef.current = true;
    let cancelled = false;

    const savePuntaje = async () => {
      try {
        await submitPuntaje({
          heroe: game.player.name,
          oro: game.campaignStats.goldEarned,
          danio_maximo: game.campaignStats.maxDamageDealt,
          reputacion: game.player.reputacionNivel,
          puntaje: game.finalScore ?? 0
        });

        if (cancelled) {
          return;
        }

        setPuntajeSubmitError(null);
        setGame((current) => {
          if (!current || current.phase !== "finished" || current.puntajeSubmitted) {
            return current;
          }

          const nextGame = { ...current, puntajeSubmitted: true };
          window.localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(nextGame));
          return nextGame;
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        puntajeSubmitStartedRef.current = false;
        const message =
          error instanceof Error ? error.message : "No se pudo guardar el puntaje en la tabla.";
        setPuntajeSubmitError(message);
      }
    };

    void savePuntaje();

    return () => {
      cancelled = true;
    };
  }, [game?.phase, game?.puntajeSubmitted, game?.finalScore, game?.player.name, game?.campaignStats, game?.player.reputacionNivel]);

  useEffect(() => {
    const logEl = combatLogRef.current;
    if (logEl) {
      logEl.scrollTop = logEl.scrollHeight;
    }
  }, [game?.combat?.log]);

  useEffect(() => {
    if (!levelXpTableOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLevelXpTableOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    const frame = window.requestAnimationFrame(() => {
      currentLevelRowRef.current?.scrollIntoView({ block: "center" });
    });

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.cancelAnimationFrame(frame);
    };
  }, [levelXpTableOpen]);

  useEffect(() => {
    if (!reputationRankTableOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setReputationRankTableOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    const frame = window.requestAnimationFrame(() => {
      currentReputationRowRef.current?.scrollIntoView({ block: "center" });
    });

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.cancelAnimationFrame(frame);
    };
  }, [reputationRankTableOpen]);

  useEffect(() => {
    let active = true;

    const loadMissions = async () => {
      const loaded = await fetchMissions();
      if (!active) {
        return;
      }

      setMissionItems(loaded);
    };

    void loadMissions();

    return () => {
      active = false;
    };
  }, []);

  const { lifeMissions } = useMemo(() => splitMissionsByType(missionItems), [missionItems]);
  const eligibleLifeMissions = useMemo(
    () => (game ? filterEligibleMissions(lifeMissions, game.player) : []),
    [game, lifeMissions]
  );

  const effectiveHeroStats = game ? getEffectiveHeroStats(game.player, itemCatalog) : null;

  const heroPrimaryStats = effectiveHeroStats
    ? [
        { label: "Fuerza", value: effectiveHeroStats.fuerza, Icon: Swords },
        { label: "Agilidad", value: effectiveHeroStats.agilidad, Icon: Footprints },
        { label: "Carisma", value: effectiveHeroStats.carisma, Icon: Users },
        { label: "Suerte", value: effectiveHeroStats.suerte, Icon: Clover }
      ]
    : [];

  const combatGear = game ? getCombatGearFromEquipment(game.player, itemCatalog) : null;

  const heroCombatStats = effectiveHeroStats
    ? [
        {
          label: "Daño",
          value: calcHeroAttackPower({ ...game!.player, stats: effectiveHeroStats }, combatGear?.weaponDano ?? 0),
          Icon: Sword
        },
        { label: "Defensa", value: effectiveHeroStats.defensa, Icon: Shield }
      ]
    : [];

  const heroSecondaryStats = game
    ? [
        {
          label: "Prob. critico",
          value: `${game.player.secondaryStats.probCritico}%`,
          Icon: Crosshair
        },
        {
          label: "Daño critico",
          value: `${game.player.secondaryStats.danoCritico}%`,
          Icon: Flame
        },
        {
          label: "Prob. esquivar",
          value: `${game.player.secondaryStats.probEsquivar}%`,
          Icon: Wind
        },
        {
          label: "Prob. bloqueo",
          value: `${game.player.secondaryStats.probBloqueo}%`,
          Icon: ShieldHalf
        }
      ]
    : [];

  const renderHeroStatCell = (stat: { label: string; value: string | number; Icon: typeof Swords }) => (
    <div
      key={stat.label}
      className="flex flex-col items-center justify-center rounded-md border border-amber-700/25 bg-stone-900/50 px-1 py-2 text-center"
    >
      <stat.Icon className="mb-1 h-4 w-4 text-amber-300" />
      <p className="text-[10px] leading-tight text-stone-300">{stat.label}</p>
      <p className="mt-0.5 text-base font-semibold text-amber-100">{stat.value}</p>
    </div>
  );

  const currentLifeMission = game ? eligibleLifeMissions[game.lifeMissionIndex] ?? null : null;
  const getEquippedItemForSlot = (slotKey: string) => {
    const itemId = game?.player.equipment[slotKey];
    return itemId ? findItemById(itemCatalog, itemId) : null;
  };

  const vidaPercent = effectiveHeroStats
    ? Math.min(100, Math.max(0, (game!.player.stats.vida / effectiveHeroStats.vidaMax) * 100))
    : 0;
  const energiaPercent = game ? Math.min(100, Math.max(0, (game.player.energia / MAX_ENERGIA) * 100)) : 0;
  const isExhausted = Boolean(game && game.player.energia <= 0);
  const reputationProgress = game
    ? getReputationProgress(game.player.stats.reputacion, game.player.reputacionNivel)
    : null;
  const experienceProgress = game
    ? getHeroExperienceProgress(game.player.experiencia, game.player.nivel)
    : null;
  const currentDayStage: 1 | 2 | 3 = game
    ? game.phase === "dayStage2" || game.phase === "shop"
      ? 2
      : game.phase === "dayStage3" || game.phase === "enemyEncounter"
      ? 3
      : game.phase === "stageMessage"
      ? game.lastStageMessage?.stage ?? 3
      : 1
    : 1;
  const dayStageIndicators: { stage: 1 | 2 | 3; label: string; Icon: typeof Sun }[] = [
    { stage: 1, label: "Sol pleno", Icon: Sun },
    { stage: 2, label: "Atardecer", Icon: Sunset },
    { stage: 3, label: "Anochecer", Icon: Moon }
  ];
  const encounterEnemyVida = game?.pendingEnemy
    ? game.combat?.enemyVida ?? game.pendingEnemy.vida
    : 0;
  const encounterEnemyVidaMax = game?.pendingEnemy
    ? game.combat?.enemyVidaMax ?? game.pendingEnemy.vida
    : 1;
  const isEncounterEnemyDefeated =
    game?.combat?.status === "won" || encounterEnemyVida <= 0;

  const finishGame = (gameState: GameState, reason: RetirementReason) => {
    const turnsPlayed = Math.max(0, gameState.turnIndex - 1);
    const finalScore = calculateFinalScore(gameState.player, gameState.campaignStats, turnsPlayed);

    persistGame({
      ...gameState,
      phase: "finished",
      retirementReason: reason,
      finalScore,
      lastBattle: null,
      lastMissionChoice: null,
      lastStageMessage: null,
      pendingDrop: null,
      pendingEnemy: null,
      pendingEncounterChoice: null,
      combat: null,
      shopOffers: []
    });
  };

  const handleSkipMissingMission = () => {
    if (!game) {
      return;
    }

    if (game.phase === "lifeMission") {
      persistGame({
        ...game,
        phase: "dayStage2",
        lastBattle: null,
        lastMissionChoice: null,
        lastStageMessage: null,
        pendingDrop: null
      });
    }
  };

  const advanceTurn = (updatedPlayer: PlayerProfile, battle: LastBattle | null) => {
    if (!game) {
      return;
    }

    const agedPlayer: PlayerProfile = {
      ...updatedPlayer,
      age: Math.min(RETIREMENT_AGE, updatedPlayer.age + 1)
    };

    const nextTurnIndex = game.turnIndex + 1;
    const nextLifeMissionIndex = game.lifeMissionIndex + 1;

    const intermediateGame = {
      ...game,
      player: agedPlayer,
      lastBattle: battle,
      lastMissionChoice: null,
      lastStageMessage: null,
      pendingDrop: null,
      pendingEnemy: null,
      pendingEncounterChoice: null,
      combat: null,
      shopOffers: [],
      turnIndex: nextTurnIndex,
      lifeMissionIndex: nextLifeMissionIndex,
      situationMissionIndex: game.situationMissionIndex + 1
    } satisfies GameState;

    if (nextTurnIndex > MAX_CAMPAIGN_TURNS || agedPlayer.age >= RETIREMENT_AGE) {
      finishGame(intermediateGame, "age");
      return;
    }

    if (nextLifeMissionIndex >= eligibleLifeMissions.length) {
      finishGame(intermediateGame, "missions");
      return;
    }

    persistGame({
      ...intermediateGame,
      phase: "lifeMission"
    });
  };

  const handleMissionChoice = (option: MissionOption, mission: Mission) => {
    if (!game || game.player.energia <= 0) {
      return;
    }

    const withEffects = applyOptionEffects(game.player, option.effects);
    const energyResult = spendEnergyPercent(withEffects, 1, 10);

    persistGame({
      ...game,
      player: energyResult.player,
      phase: "missionResult",
      lastBattle: null,
      lastStageMessage: null,
      pendingDrop: null,
      lastMissionChoice: {
        missionTitle: mission.title,
        missionType: mission.type,
        selectedOptionText: option.text,
        response: option.response,
        effects: option.effects,
        energiaSpent: energyResult.spent
      }
    });
  };

  const handleStage1ExhaustedRest = () => {
    if (!game || game.player.energia > 0) {
      return;
    }

    const restResult = applyRestRecovery(game.player);
    persistGame({
      ...game,
      player: restResult.player,
      phase: "stageMessage",
      lastBattle: null,
      lastMissionChoice: null,
      lastStageMessage: {
        stage: 1,
        text: "Estabas agotado y tuviste que descansar",
        recovered: restResult.recovered
      },
      pendingDrop: null
    });
  };

  const handleContinueMissionResult = () => {
    if (!game?.lastMissionChoice) {
      return;
    }

    if (game.lastMissionChoice.missionType === "vida") {
      persistGame({
        ...game,
        phase: "dayStage2",
        lastMissionChoice: null
      });
      return;
    }

    persistGame({
      ...game,
      phase: "dayStage3",
      lastMissionChoice: null
    });
  };

  const handleDayStage2Choice = (choice: "shop" | "rest" | "work") => {
    if (!game) {
      return;
    }

    if (choice !== "rest" && game.player.energia <= 0) {
      return;
    }

    if (choice === "shop") {
      const energyResult = spendEnergyPercent(game.player, 5, 15);
      const offers = pickShopOffers(itemCatalog);
      persistGame({
        ...game,
        player: energyResult.player,
        phase: "shop",
        lastBattle: null,
        lastMissionChoice: null,
        lastStageMessage: null,
        pendingDrop: null,
        shopOffers: offers.map((item) => item.id)
      });
      return;
    }

    if (choice === "work") {
      const energyResult = spendEnergyPercent(game.player, 10, 20);
      persistGame({
        ...game,
        player: energyResult.player,
        phase: "stageMessage",
        lastBattle: null,
        lastMissionChoice: null,
        lastStageMessage: {
          stage: 2,
          text: "Te pusiste a trabajar",
          spent: { energia: energyResult.spent }
        },
        pendingDrop: null
      });
      return;
    }

    const restResult = applyRestRecovery(game.player);
    persistGame({
      ...game,
      player: restResult.player,
      phase: "stageMessage",
      lastBattle: null,
      lastMissionChoice: null,
      lastStageMessage: {
        stage: 2,
        text: "Te detuviste a descansar",
        recovered: restResult.recovered
      },
      pendingDrop: null
    });
  };

  const handleDayStage3Choice = (choice: "rest" | DayStage3EncounterChoice) => {
    if (!game) {
      return;
    }

    if (choice !== "rest" && game.player.energia <= 0) {
      return;
    }

    if (choice === "rest") {
      const restResult = applyRestRecovery(game.player);
      persistGame({
        ...game,
        player: restResult.player,
        phase: "stageMessage",
        lastBattle: null,
        lastMissionChoice: null,
        lastStageMessage: {
          stage: 3,
          text: "Te detuviste a descansar",
          recovered: restResult.recovered
        },
        pendingDrop: null,
        pendingEnemy: null,
        pendingEncounterChoice: null,
        combat: null
      });
      return;
    }

    const selectedEnemy = pickRandomEnemigoForEncounter(enemigoItems, game.player.nivel, choice);

    if (!selectedEnemy) {
      persistGame({
        ...game,
        phase: "stageMessage",
        lastBattle: null,
        lastMissionChoice: null,
        lastStageMessage: {
          stage: 3,
          text: `No encontraste enemigos adecuados para ${getEncounterChoiceLabel(choice).toLowerCase()}.`
        },
        pendingDrop: null,
        pendingEnemy: null,
        pendingEncounterChoice: null,
        combat: null
      });
      return;
    }

    const energyResult = spendEnergyPercent(game.player, 10, 30);
    const combat = createCombatState(selectedEnemy);

    persistGame({
      ...game,
      player: energyResult.player,
      phase: "enemyEncounter",
      lastBattle: null,
      lastMissionChoice: null,
      lastStageMessage: null,
      pendingDrop: null,
      pendingEnemy: selectedEnemy,
      pendingEncounterChoice: choice,
      combat: {
        ...combat,
        log: [`Gastaste ${energyResult.spent} de energia.`, ...combat.log]
      }
    });
  };

  const handleCombatAction = (action: CombatAction) => {
    if (!game?.pendingEnemy || !game.combat || game.combat.status !== "active") {
      return;
    }

    const effectivePlayer = {
      ...game.player,
      stats: getEffectiveHeroStats(game.player, itemCatalog)
    };
    const gear = getCombatGearFromEquipment(game.player, itemCatalog);

    const result = resolveCombatTurn({
      action,
      player: effectivePlayer,
      enemy: game.pendingEnemy,
      combat: game.combat,
      gear
    });

    let nextPlayer: PlayerProfile = {
      ...game.player,
      stats: {
        ...game.player.stats,
        vida: result.player.stats.vida
      }
    };

    let nextCombat = result.combat;
    let pendingDrop = game.pendingDrop;
    let nextCampaignStats = game.campaignStats;

    const previousHeroDamage = game.combat.heroDamageDone;
    const hitDamage = result.combat.heroDamageDone - previousHeroDamage;
    if (hitDamage > nextCampaignStats.maxDamageDealt) {
      nextCampaignStats = {
        ...nextCampaignStats,
        maxDamageDealt: hitDamage
      };
    }

    if (result.combat.status === "won") {
      nextPlayer = applyVictoryRewards(nextPlayer, game.pendingEnemy);
      nextCampaignStats = {
        ...nextCampaignStats,
        enemiesKilled: nextCampaignStats.enemiesKilled + 1
      };
      const droppedItem = rollDroppedItem(itemCatalog, game.pendingEnemy);

      if (droppedItem) {
        const inventoryResult = addItemToInventory(nextPlayer, droppedItem.id);
        nextPlayer = inventoryResult.player;
        pendingDrop = droppedItem;
        nextCombat = {
          ...result.combat,
          log: [
            ...result.combat.log,
            inventoryResult.ok
              ? `Obtuviste: ${droppedItem.name} (guardado en inventario).`
              : `Obtuviste: ${droppedItem.name}, pero ${inventoryResult.message}`
          ].slice(-12)
        };
      } else {
        pendingDrop = null;
        nextCombat = {
          ...result.combat,
          log: [...result.combat.log, "No obtuviste botin esta vez."].slice(-12)
        };
      }
    }

    persistGame({
      ...game,
      player: nextPlayer,
      pendingDrop,
      combat: nextCombat,
      campaignStats: nextCampaignStats
    });
  };

  const handleInventoryItemClick = (slotIndex: number) => {
    if (!game) {
      return;
    }

    const itemId = game.player.inventory[slotIndex];
    if (!itemId) {
      return;
    }

    const item = findItemById(itemCatalog, itemId);
    if (!item) {
      return;
    }

    const result = isConsumableItem(item)
      ? consumeItemFromInventory(game.player, slotIndex, item)
      : equipItemFromInventory(game.player, slotIndex, item);

    if (!result.ok) {
      window.alert(result.message);
      return;
    }

    persistGame({
      ...game,
      player: result.player
    });
  };

  const handleEquipmentSlotClick = (slotKey: string) => {
    if (!game) {
      return;
    }

    const result = unequipItemToInventory(game.player, slotKey);
    if (!result.ok) {
      window.alert(result.message);
      return;
    }

    persistGame({
      ...game,
      player: result.player
    });
  };

  const handleLeaveShop = () => {
    if (!game || game.phase !== "shop") {
      return;
    }

    persistGame({
      ...game,
      phase: "dayStage3",
      shopOffers: []
    });
  };

  const handleShopBuy = (itemId: string) => {
    if (!game || game.phase !== "shop") {
      return;
    }

    const item = findItemById(itemCatalog, itemId);
    if (!item) {
      return;
    }

    const buyPrice = getShopBuyPrice(item.cost, game.player.stats.carisma);
    const result = buyItemToInventory(game.player, item.id, buyPrice);
    if (!result.ok) {
      window.alert(result.message);
      return;
    }

    persistGame({
      ...game,
      player: result.player,
      shopOffers: game.shopOffers.filter((offerId) => offerId !== item.id)
    });
  };

  const handleShopSell = (slotIndex: number) => {
    if (!game || game.phase !== "shop") {
      return;
    }

    const itemId = game.player.inventory[slotIndex];
    if (!itemId) {
      return;
    }

    const item = findItemById(itemCatalog, itemId);
    if (!item) {
      return;
    }

    const sellPrice = getShopSellPrice(item.cost, game.player.stats.carisma);
    const result = sellItemFromInventoryAt(game.player, slotIndex, sellPrice);
    if (!result.ok) {
      window.alert(result.message);
      return;
    }

    persistGame({
      ...game,
      player: result.player,
      campaignStats: {
        ...game.campaignStats,
        goldEarned: game.campaignStats.goldEarned + sellPrice
      }
    });
  };

  const handleFinishEnemyEncounter = () => {
    if (!game?.combat || game.combat.status === "active") {
      return;
    }

    if (game.combat.status === "lost") {
      finishGame(game, "death");
      return;
    }

    advanceTurn(game.player, null);
  };

  const handleContinueStageMessage = () => {
    if (!game?.lastStageMessage) {
      return;
    }

    if (game.lastStageMessage.stage === 1) {
      persistGame({
        ...game,
        phase: "dayStage2",
        lastStageMessage: null
      });
      return;
    }

    if (game.lastStageMessage.stage === 2) {
      persistGame({
        ...game,
        phase: "dayStage3",
        lastStageMessage: null
      });
      return;
    }

    advanceTurn(game.player, null);
  };

  const handleContinue = () => {
    if (!game) {
      return;
    }

    advanceTurn(game.player, game.lastBattle);
  };

  const handleResetCampaign = () => {
    if (!game) {
      return;
    }

    setPuntajeSubmitError(null);
    puntajeSubmitStartedRef.current = false;

    persistGame({
      ...game,
      turnIndex: 1,
      lifeMissionIndex: 0,
      situationMissionIndex: 0,
      dungeonIndex: 0,
      phase: "lifeMission",
      lastBattle: null,
      lastMissionChoice: null,
      lastStageMessage: null,
      pendingDrop: null,
      pendingEnemy: null,
      pendingEncounterChoice: null,
      combat: null,
      shopOffers: [],
      campaignStats: createInitialCampaignStats(game.player.coins),
      retirementReason: null,
      finalScore: null,
      puntajeSubmitted: false,
      player: {
        ...game.player,
        age: DEFAULT_HERO_AGE
      }
    });
  };

  const handleResetPartida = () => {
    const confirmed = window.confirm(
      "¿Reiniciar partida? Se borrara tu personaje y todo el progreso. Vas a tener que crear uno nuevo desde cero."
    );
    if (!confirmed) {
      return;
    }

    window.localStorage.removeItem(PLAYER_STORAGE_KEY);
    window.localStorage.removeItem(GAME_STORAGE_KEY);
    router.push("/");
  };

  if (!game) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-lg border-amber-800/40 bg-stone-950/85">
          <CardHeader>
            <CardTitle className="font-[var(--font-cinzel)] text-amber-200">
              No hay heroe creado
            </CardTitle>
            <CardDescription className="text-stone-300">
              Primero crea tu personaje para empezar la aventura.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/")} className="w-full">
              Volver al inicio
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-[88rem] grid-cols-1 gap-4 md:grid-cols-12 md:items-stretch md:gap-6">
        <aside className="md:col-span-3 md:flex">
          <Card className="flex h-full min-h-[calc(100vh-3rem)] w-full flex-col border-amber-800/45 bg-stone-950/85 backdrop-blur-md">
          <CardHeader className="pb-3 text-center">
            <CardTitle className="font-[var(--font-cinzel)] text-2xl text-amber-100">
              {game.player.name}
            </CardTitle>
            {experienceProgress && (
              <div className="mx-auto mt-2 w-full max-w-[14rem]">
                <p className="text-xs font-medium uppercase tracking-[0.12em] text-amber-300/90">
                  <button
                    type="button"
                    onClick={() => setLevelXpTableOpen(true)}
                    className="rounded-sm underline decoration-amber-500/50 underline-offset-4 transition-colors hover:text-amber-200 hover:decoration-amber-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
                    aria-haspopup="dialog"
                    aria-expanded={levelXpTableOpen}
                  >
                    Nivel
                  </button>{" "}
                  {experienceProgress.level}
                </p>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full border border-amber-900/40 bg-stone-950">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-800 to-amber-400 transition-[width]"
                    style={{ width: `${experienceProgress.progressPercent}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] tabular-nums text-stone-400">
                  {experienceProgress.isMaxLevel
                    ? "Nivel maximo"
                    : `${experienceProgress.currentXp}/${experienceProgress.xpToNextLevel} XP`}
                </p>
              </div>
            )}
          </CardHeader>
          <CardContent className="flex flex-1 flex-col text-sm">
            <div className="flex-1 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-amber-700/30 bg-stone-900/60 p-3 text-center">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-amber-300/80">Edad</p>
                  <p className="mt-1 text-lg font-semibold text-amber-100">{game.player.age}</p>
                </div>
                <div className="rounded-lg border border-amber-700/30 bg-stone-900/60 p-3 text-center">
                  <p className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-[0.15em] text-amber-300/80">
                    <Coins className="h-3 w-3" />
                    Monedas
                  </p>
                  <p className="mt-1 text-lg font-semibold text-amber-100">{game.player.coins}</p>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-amber-700/30 bg-stone-900/60 p-3">
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-stone-200">
                    <span className="flex items-center gap-1.5 font-medium text-amber-100">
                      <HeartPulse className="h-3.5 w-3.5 text-red-400" />
                      Vida
                    </span>
                    <span className="tabular-nums text-stone-300">
                      {game.player.stats.vida}/{effectiveHeroStats?.vidaMax ?? game.player.stats.vidaMax}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full border border-amber-900/40 bg-stone-950">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-red-700 to-red-500 transition-[width]"
                      style={{ width: `${vidaPercent}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-stone-200">
                    <span className="flex items-center gap-1.5 font-medium text-amber-100">
                      <Zap className="h-3.5 w-3.5 text-amber-400" />
                      Energia
                    </span>
                    <span className="tabular-nums text-stone-300">
                      {game.player.energia}/{MAX_ENERGIA}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full border border-amber-900/40 bg-stone-950">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-700 to-yellow-400 transition-[width]"
                      style={{ width: `${energiaPercent}%` }}
                    />
                  </div>
                </div>
                {reputationProgress && (
                  <div>
                    <div className="mb-1 flex items-center justify-between text-xs text-stone-200">
                      <span className="flex min-w-0 flex-col items-start gap-0.5 font-medium text-amber-100">
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                          <button
                            type="button"
                            onClick={() => setReputationRankTableOpen(true)}
                            className="rounded-sm underline decoration-violet-500/50 underline-offset-4 transition-colors hover:text-amber-50 hover:decoration-violet-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-400"
                            aria-haspopup="dialog"
                            aria-expanded={reputationRankTableOpen}
                          >
                            Reputacion
                          </button>{" "}
                          <span className="tabular-nums text-stone-300">{reputationProgress.rank}</span>
                        </span>
                        <span className="text-[10px] font-normal uppercase tracking-[0.08em] text-violet-300/90">
                          {reputationProgress.rankName}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums text-stone-300">
                        {reputationProgress.isMaxRank
                          ? "Max"
                          : `${reputationProgress.currentXp}/${reputationProgress.xpToNextRank}`}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full border border-amber-900/40 bg-stone-950">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-800 to-fuchsia-500 transition-[width]"
                        style={{ width: `${reputationProgress.progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-amber-700/30 bg-amber-900/15 p-3">
                <p className="mb-3 flex items-center gap-2 text-amber-200">
                  <Shield className="h-4 w-4" />
                  Stats principales
                </p>
                <div className="grid grid-cols-4 gap-2 text-stone-100">
                  {heroPrimaryStats.map(renderHeroStatCell)}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-stone-100">
                  {heroCombatStats.map(renderHeroStatCell)}
                </div>
              </div>

              <div className="rounded-lg border border-amber-700/30 bg-stone-900/40 p-3">
                <p className="mb-3 flex items-center gap-2 text-amber-200">
                  <Crosshair className="h-4 w-4" />
                  Stats secundarios
                </p>
                <div className="grid grid-cols-2 gap-2 text-stone-100">
                  {heroSecondaryStats.map(renderHeroStatCell)}
                </div>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="mt-4 w-full"
              onClick={() => router.push("/puntajes")}
            >
              <Trophy className="mr-2 h-4 w-4" />
              Tabla de puntajes
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="mt-2 w-full border border-red-900/45 bg-red-950/25 text-red-100 hover:bg-red-950/45"
              onClick={handleResetPartida}
            >
              Reiniciar partida
            </Button>
          </CardContent>
        </Card>
        </aside>

        <section className="md:col-span-6 md:flex">
          <Card className="flex h-full min-h-[calc(100vh-3rem)] w-full flex-col border-amber-800/45 bg-stone-950/85 backdrop-blur-md">
            <CardHeader className="pb-3">
              <div className="grid grid-cols-3 gap-2">
                {dayStageIndicators.map((stageItem) => {
                  const isActive = stageItem.stage === currentDayStage;
                  return (
                    <div
                      key={stageItem.stage}
                      className={`rounded-lg border px-2 py-2 text-center transition-colors ${
                        isActive
                          ? "border-amber-500/70 bg-amber-900/30 text-amber-100"
                          : "border-amber-900/40 bg-stone-950/60 text-stone-400"
                      }`}
                    >
                      <stageItem.Icon className="mx-auto h-4 w-4" />
                      <p className="mt-1 text-[10px] uppercase tracking-[0.14em]">{stageItem.label}</p>
                    </div>
                  );
                })}
              </div>
            </CardHeader>

            <CardContent className="flex flex-1 flex-col rounded-b-xl border-t border-amber-700/20 bg-stone-900/50 p-4">

              {game.phase === "lifeMission" && currentLifeMission && (
                <div className="space-y-4">
                  {isExhausted ? (
                    <>
                      <div className="rounded-lg border border-amber-700/25 bg-stone-900/60 p-4">
                        <p className="mb-1 text-xs uppercase tracking-[0.2em] text-amber-300/80">
                          Dia {game.turnIndex} - Etapa 1
                        </p>
                        <h3 className="font-[var(--font-cinzel)] text-2xl text-amber-100">Sin energia</h3>
                        <p className="mt-2 text-stone-300">
                          Estas agotado. La unica accion disponible es descansar.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-auto w-full justify-start whitespace-normal border border-amber-700/30 bg-stone-800/80 py-3 text-left text-stone-100 hover:bg-stone-700"
                        onClick={handleStage1ExhaustedRest}
                      >
                        Descansar
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="rounded-lg border border-amber-700/25 bg-stone-900/60 p-4">
                        <p className="mb-1 text-xs uppercase tracking-[0.2em] text-amber-300/80">
                          Dia {game.turnIndex} - Etapa 1
                        </p>
                        <h3 className="font-[var(--font-cinzel)] text-2xl text-amber-100">
                          {currentLifeMission.title}
                        </h3>
                        <p className="mt-2 text-stone-300">{currentLifeMission.description}</p>
                      </div>

                      <div className="grid gap-3">
                        {currentLifeMission.options.map((option) => (
                          <Button
                            key={option.id}
                            type="button"
                            variant="secondary"
                            className="h-auto justify-start whitespace-normal border border-amber-700/30 bg-stone-800/80 py-3 text-left text-stone-100 hover:bg-stone-700"
                            onClick={() => handleMissionChoice(option, currentLifeMission)}
                          >
                            {option.text}
                          </Button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {game.phase === "lifeMission" && !currentLifeMission && (
                <div className="space-y-4 rounded-lg border border-amber-700/25 bg-stone-900/60 p-5 text-center">
                  {isExhausted ? (
                    <>
                      <h3 className="font-[var(--font-cinzel)] text-2xl text-amber-100">Sin energia</h3>
                      <p className="text-stone-300">
                        Estas agotado. La unica accion disponible es descansar.
                      </p>
                      <Button onClick={handleStage1ExhaustedRest} className="w-full">
                        Descansar
                      </Button>
                    </>
                  ) : (
                    <>
                      <h3 className="font-[var(--font-cinzel)] text-2xl text-amber-100">Sin mision de vida elegible</h3>
                      <p className="text-stone-300">
                        No hay una mision disponible para tu nivel/reputacion en este turno.
                      </p>
                      <Button onClick={handleSkipMissingMission} className="w-full">
                        Continuar
                      </Button>
                    </>
                  )}
                </div>
              )}

              {game.phase === "missionResult" && game.lastMissionChoice && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-amber-700/25 bg-stone-900/60 p-4">
                    <p className="mb-1 text-xs uppercase tracking-[0.2em] text-amber-300/80">
                      Dia {game.turnIndex} - Etapa 1
                    </p>
                    <h3 className="font-[var(--font-cinzel)] text-2xl text-amber-100">
                      {game.lastMissionChoice.missionTitle}
                    </h3>
                    <p className="mt-2 text-sm text-stone-400">
                      Elegiste: {game.lastMissionChoice.selectedOptionText}
                    </p>
                    {game.lastMissionChoice.response && (
                      <p className="mt-4 text-stone-200">{game.lastMissionChoice.response}</p>
                    )}
                  </div>

                  <div className="rounded-lg border border-amber-600/35 bg-amber-950/20 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-300/90">Efecto de tu accion</p>
                    <ul className="mt-3 space-y-1 text-stone-100">
                      {formatMissionEffects(game.lastMissionChoice.effects).map((effectLine) => (
                        <li key={effectLine} className="text-sm">
                          {effectLine}
                        </li>
                      ))}
                      {(game.lastMissionChoice.energiaSpent ?? 0) > 0 && (
                        <li className="text-sm">-{game.lastMissionChoice.energiaSpent} Energia</li>
                      )}
                    </ul>
                  </div>

                  <Button onClick={handleContinueMissionResult} className="w-full">
                    Continuar
                  </Button>
                </div>
              )}

              {game.phase === "dayStage2" && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-amber-700/25 bg-stone-900/60 p-4">
                    <p className="mb-1 text-xs uppercase tracking-[0.2em] text-amber-300/80">Dia {game.turnIndex} - Etapa 2</p>
                    <h3 className="font-[var(--font-cinzel)] text-2xl text-amber-100">
                      {isExhausted ? "Sin energia" : "Decidi tu actividad"}
                    </h3>
                    <p className="mt-2 text-stone-300">
                      {isExhausted
                        ? "Estas agotado. La unica accion disponible es descansar."
                        : "Elegi si queres pasar por la tienda, descansar o trabajar."}
                    </p>
                  </div>
                  <div className="grid gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isExhausted}
                      className="h-auto justify-start whitespace-normal border border-amber-700/30 bg-stone-800/80 py-3 text-left text-stone-100 hover:bg-stone-700"
                      onClick={() => handleDayStage2Choice("shop")}
                    >
                      Ir a la tienda
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-auto justify-start whitespace-normal border border-amber-700/30 bg-stone-800/80 py-3 text-left text-stone-100 hover:bg-stone-700"
                      onClick={() => handleDayStage2Choice("rest")}
                    >
                      Descansar
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isExhausted}
                      className="h-auto justify-start whitespace-normal border border-amber-700/30 bg-stone-800/80 py-3 text-left text-stone-100 hover:bg-stone-700"
                      onClick={() => handleDayStage2Choice("work")}
                    >
                      Trabajar
                    </Button>
                  </div>
                </div>
              )}

              {game.phase === "shop" && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-amber-700/25 bg-stone-900/60 p-4">
                    <p className="mb-1 text-xs uppercase tracking-[0.2em] text-amber-300/80">
                      Dia {game.turnIndex} - Etapa 2
                    </p>
                    <h3 className="font-[var(--font-cinzel)] text-2xl text-amber-100">Tienda del pueblo</h3>
                    <p className="mt-2 text-stone-300">
                      Compra ofertas del dia o vende copias de items de tu inventario.
                    </p>
                    <p className="mt-2 text-sm text-amber-200/90">
                      Carisma {game.player.stats.carisma}: {formatCharismaTradeHint(game.player.stats.carisma)}
                    </p>
                    <p className="mt-1 text-sm text-stone-400">
                      Monedas disponibles: {game.player.coins}
                    </p>
                  </div>

                  <div className="rounded-lg border border-amber-700/25 bg-stone-900/60 p-4">
                    <p className="mb-3 text-xs uppercase tracking-[0.2em] text-amber-300/80">Comprar</p>
                    {game.shopOffers.length === 0 ? (
                      <p className="text-sm text-stone-400">Hoy no hay ofertas disponibles.</p>
                    ) : (
                      <div className="grid gap-3">
                        {game.shopOffers.map((offerId) => {
                          const offerItem = findItemById(itemCatalog, offerId);
                          if (!offerItem) {
                            return null;
                          }

                          const buyPrice = getShopBuyPrice(offerItem.cost, game.player.stats.carisma);
                          const canAfford = game.player.coins >= buyPrice;

                          return (
                            <div
                              key={`shop-offer-${offerId}`}
                              className="flex flex-col gap-3 rounded-md border border-amber-700/25 bg-stone-950/70 p-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="flex items-center gap-3">
                                {offerItem.image ? (
                                  <>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={resolveItemImage(offerItem.image)}
                                      alt={offerItem.name}
                                      className="h-12 w-12 object-contain"
                                    />
                                  </>
                                ) : null}
                                <div>
                                  <p className="font-medium text-amber-100">{offerItem.name}</p>
                                  <p className="text-xs text-stone-400">
                                    {offerItem.rarity} · Nivel {offerItem.nivel} · Base {offerItem.cost} monedas
                                  </p>
                                  {getItemEffectLines(offerItem.effects).length > 0 && (
                                    <ul className="mt-1 text-xs">
                                      {getItemEffectLines(offerItem.effects).map((effect) => (
                                        <li
                                          key={`shop-offer-${offerId}-${effect.key}`}
                                          className={effect.value > 0 ? "text-emerald-300" : "text-red-300"}
                                        >
                                          {effect.value > 0 ? "+" : ""}
                                          {effect.value} {effect.label}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              </div>
                              <Button
                                type="button"
                                disabled={!canAfford}
                                onClick={() => handleShopBuy(offerId)}
                                className="shrink-0"
                              >
                                Comprar por {buyPrice} monedas
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-amber-700/25 bg-stone-900/60 p-4">
                    <p className="mb-3 text-xs uppercase tracking-[0.2em] text-amber-300/80">Vender</p>
                    {game.player.inventory.every((itemId) => !itemId) ? (
                      <p className="text-sm text-stone-400">No tenes items para vender.</p>
                    ) : (
                      <div className="grid gap-3">
                        {game.player.inventory.map((itemId, slotIndex) => {
                          if (!itemId) {
                            return null;
                          }

                          const storedItem = findItemById(itemCatalog, itemId);
                          if (!storedItem) {
                            return null;
                          }

                          const sellPrice = getShopSellPrice(storedItem.cost, game.player.stats.carisma);

                          return (
                            <div
                              key={`shop-sell-${slotIndex}`}
                              className="flex flex-col gap-3 rounded-md border border-amber-700/25 bg-stone-950/70 p-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div className="flex items-center gap-3">
                                {storedItem.image ? (
                                  <>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={resolveItemImage(storedItem.image)}
                                      alt={storedItem.name}
                                      className="h-12 w-12 object-contain"
                                    />
                                  </>
                                ) : null}
                                <div>
                                  <p className="font-medium text-amber-100">{storedItem.name}</p>
                                  <p className="text-xs text-stone-400">
                                    Valor base {storedItem.cost} monedas
                                  </p>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => handleShopSell(slotIndex)}
                                className="shrink-0"
                              >
                                Vender por {sellPrice} monedas
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <Button type="button" onClick={handleLeaveShop} className="w-full">
                    Salir de la tienda
                  </Button>
                </div>
              )}

              {game.phase === "dayStage3" && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-amber-700/25 bg-stone-900/60 p-4">
                    <p className="mb-1 text-xs uppercase tracking-[0.2em] text-amber-300/80">Dia {game.turnIndex} - Etapa 3</p>
                    <h3 className="font-[var(--font-cinzel)] text-2xl text-amber-100">
                      {isExhausted ? "Sin energia" : "Elegi tu accion final del dia"}
                    </h3>
                    <p className="mt-2 text-stone-300">
                      {isExhausted
                        ? "Estas agotado. La unica accion disponible es descansar."
                        : "La accion que tomes define el cierre de la jornada."}
                    </p>
                  </div>
                  <div className="grid gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-auto justify-start whitespace-normal border border-amber-700/30 bg-stone-800/80 py-3 text-left text-stone-100 hover:bg-stone-700"
                      onClick={() => handleDayStage3Choice("rest")}
                    >
                      Seguir descansando
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isExhausted}
                      className="h-auto justify-start whitespace-normal border border-amber-700/30 bg-stone-800/80 py-3 text-left text-stone-100 hover:bg-stone-700"
                      onClick={() => handleDayStage3Choice("defend")}
                    >
                      Defender los caminos
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isExhausted}
                      className="h-auto justify-start whitespace-normal border border-amber-700/30 bg-stone-800/80 py-3 text-left text-stone-100 hover:bg-stone-700"
                      onClick={() => handleDayStage3Choice("cave")}
                    >
                      Ingresar a cueva
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isExhausted}
                      className="h-auto justify-start whitespace-normal border border-amber-700/30 bg-stone-800/80 py-3 text-left text-stone-100 hover:bg-stone-700"
                      onClick={() => handleDayStage3Choice("dungeon")}
                    >
                      Ingresar a Mazmorra
                    </Button>
                  </div>
                </div>
              )}

              {game.phase === "enemyEncounter" && game.pendingEnemy && game.pendingEncounterChoice && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-amber-700/25 bg-stone-900/60 p-4">
                    <p className="mb-1 text-xs uppercase tracking-[0.2em] text-amber-300/80">
                      Dia {game.turnIndex} - Etapa 3
                    </p>
                    <h3 className="font-[var(--font-cinzel)] text-2xl text-amber-100">
                      {getEncounterChoiceLabel(game.pendingEncounterChoice)}
                    </h3>
                    <p className="mt-2 text-stone-300">
                      {game.combat?.status === "won"
                        ? `Victoria. Ganaste ${game.pendingEnemy.experiencia} XP y +${game.pendingEnemy.reputacion} reputacion.`
                        : game.combat?.status === "lost"
                          ? "Has muerto en batalla. Tu aventura termina aqui."
                          : game.combat?.status === "fled"
                            ? "Lograste escapar del combate."
                            : "Te cruzaste con un enemigo. Elige tu accion cada turno."}
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="relative overflow-hidden rounded-lg border border-amber-700/25 bg-stone-950/70">
                      {game.pendingEnemy.imagen ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={resolveEnemigoImagen(game.pendingEnemy.imagen)}
                            alt={game.pendingEnemy.nombre}
                            className={`h-64 w-full object-cover transition-[filter] ${
                              isEncounterEnemyDefeated ? "grayscale" : ""
                            }`}
                          />
                        </>
                      ) : (
                        <div className="flex h-64 items-center justify-center bg-stone-900/80 text-stone-400">
                          Sin imagen
                        </div>
                      )}
                      {isEncounterEnemyDefeated && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-stone-950/55">
                          <Skull className="h-24 w-24 text-stone-200/45" strokeWidth={1.25} />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-stone-950/95 via-stone-950/80 to-transparent px-3 pb-3 pt-8">
                        <div className="mb-1 flex items-center justify-between text-xs text-stone-200">
                          <span className="flex items-center gap-1.5 font-medium text-amber-100">
                            <HeartPulse className="h-3.5 w-3.5 text-red-400" />
                            Vida
                          </span>
                          <span className="tabular-nums text-stone-300">
                            {encounterEnemyVida}/{encounterEnemyVidaMax}
                          </span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full border border-amber-900/40 bg-stone-950/90">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-red-700 to-red-500 transition-[width]"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(0, (encounterEnemyVida / encounterEnemyVidaMax) * 100)
                              )}%`
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-lg border border-amber-700/25 bg-stone-900/60 p-4">
                        <div className="mb-3 flex items-start justify-between gap-2">
                          <p className="font-[var(--font-cinzel)] text-xl text-amber-100">
                            {game.pendingEnemy.nombre}
                          </p>
                          <span className="shrink-0 rounded border border-amber-700/35 bg-amber-950/40 px-2 py-0.5 text-xs text-amber-200">
                            Nivel {game.pendingEnemy.nivel}
                          </span>
                        </div>

                        <div className="rounded-lg border border-amber-700/30 bg-amber-900/15 p-3">
                          <p className="mb-3 flex items-center gap-2 text-amber-200">
                            <Shield className="h-4 w-4" />
                            Stats del enemigo
                          </p>
                          <div className="grid grid-cols-4 gap-2 text-stone-100">
                            {[
                              { label: "Ataque", value: game.pendingEnemy.ataque, Icon: Sword },
                              { label: "Defensa", value: game.pendingEnemy.defensa, Icon: Shield },
                              {
                                label: "Bloqueo",
                                value: game.pendingEnemy.bloqueo,
                                Icon: ShieldHalf
                              },
                              { label: "Esquiva", value: game.pendingEnemy.esquiva, Icon: Wind }
                            ].map(renderHeroStatCell)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {game.combat && game.combat.log.length > 0 && (
                    <div className="rounded-lg border border-amber-700/25 bg-stone-900/60 p-3">
                      <p className="mb-2 text-xs uppercase tracking-[0.2em] text-amber-300/80">
                        Combate
                      </p>
                      <ul
                        ref={combatLogRef}
                        className="max-h-36 space-y-1 overflow-y-auto text-sm"
                      >
                        {game.combat.log.map((line, index) => (
                          <li key={`${index}-${line}`} className={getCombatLogClassName(line)}>
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {game.combat?.status === "active" ? (
                    <div className="grid gap-2 md:grid-cols-3">
                      <Button type="button" onClick={() => handleCombatAction("attack")}>
                        <Sword className="mr-2 h-4 w-4" />
                        Atacar
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handleCombatAction("defend")}
                      >
                        <Shield className="mr-2 h-4 w-4" />
                        Defender
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="border border-amber-700/30"
                        onClick={() => handleCombatAction("flee")}
                      >
                        <Footprints className="mr-2 h-4 w-4" />
                        Huir
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {game.combat?.status === "won" && game.pendingDrop && (
                        <div className="rounded-lg border border-emerald-700/35 bg-emerald-950/20 p-4 text-sm text-stone-100">
                          <p className="font-semibold text-emerald-200">Botin obtenido</p>
                          <p className="mt-1">
                            {game.pendingDrop.name} — guardado en inventario
                          </p>
                          {game.pendingDrop.image && (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={resolveItemImage(game.pendingDrop.image)}
                                alt={game.pendingDrop.name}
                                className="mt-2 h-16 w-16 object-contain"
                              />
                            </>
                          )}
                        </div>
                      )}
                      <Button onClick={handleFinishEnemyEncounter} className="w-full">
                        Continuar
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {game.phase === "stageMessage" && game.lastStageMessage && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-amber-700/25 bg-stone-900/60 p-4">
                    <p className="mb-1 text-xs uppercase tracking-[0.2em] text-amber-300/80">
                      Dia {game.turnIndex} - Etapa {game.lastStageMessage.stage}
                    </p>
                    <h3 className="font-[var(--font-cinzel)] text-2xl text-amber-100">{game.lastStageMessage.text}</h3>
                    {game.lastStageMessage.recovered && (
                      <ul className="mt-3 space-y-1 text-stone-200">
                        <li className="text-sm">Vida recuperada: +{game.lastStageMessage.recovered.vida}</li>
                        <li className="text-sm">Energia recuperada: +{game.lastStageMessage.recovered.energia}</li>
                      </ul>
                    )}
                    {game.lastStageMessage.spent && game.lastStageMessage.spent.energia > 0 && (
                      <ul className="mt-3 space-y-1 text-stone-200">
                        <li className="text-sm">Energia gastada: -{game.lastStageMessage.spent.energia}</li>
                      </ul>
                    )}
                  </div>
                  <div className="rounded-lg border border-amber-600/35 bg-amber-950/20 p-4 text-sm text-stone-100">
                    {game.lastStageMessage.stage === 1
                      ? "Recuperaste algo de fuerzas. Al continuar, sigue el atardecer."
                      : game.lastStageMessage.stage === 2
                        ? "La noche se acerca. Falta elegir la accion final del dia."
                        : "Cerraste las tres etapas del dia. Al continuar, empieza un nuevo dia y tu heroe cumple un anio."}
                  </div>
                  <Button onClick={handleContinueStageMessage} className="w-full">
                    Continuar
                  </Button>
                </div>
              )}

              {game.phase === "battle" && game.lastBattle && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-amber-700/25 bg-stone-900/60 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-300/80">Resultado del combate</p>
                    <h3 className="mt-1 font-[var(--font-cinzel)] text-2xl text-amber-100">
                      {game.lastBattle.enemy.name} ({game.lastBattle.enemy.difficulty})
                    </h3>
                    <p className="mt-2 text-stone-300">Mision: {game.lastBattle.missionTitle}</p>
                    <p className="text-stone-300">Decision elegida: {game.lastBattle.selectedOption}</p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="overflow-hidden rounded-lg border border-amber-700/25 bg-stone-950/70">
                      {/* We use external image URLs from the enemy dataset. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={game.lastBattle.enemy.image}
                        alt={game.lastBattle.enemy.name}
                        className="h-64 w-full object-cover"
                      />
                    </div>
                    <div className="rounded-lg border border-amber-700/25 bg-stone-900/60 p-4 text-sm text-stone-200">
                      <p className="font-semibold text-amber-100">
                        {game.lastBattle.winner === "hero" ? "Victoria del heroe" : "Victoria del enemigo"}
                      </p>
                      <p className="mt-2">Rondas: {game.lastBattle.rounds}</p>
                      <p>Danio causado por el heroe: {game.lastBattle.heroDamageDone}</p>
                      <p>Danio recibido por el heroe: {game.lastBattle.enemyDamageDone}</p>
                      <p>Vida restante del heroe: {game.lastBattle.heroLifeAfter}</p>
                      <p className="mt-2 text-amber-200">
                        Reputacion ganada por la batalla: +{game.lastBattle.reputationGain}
                      </p>
                    </div>
                  </div>

                  {game.lastBattle.winner === "hero" && game.pendingDrop && (
                    <div className="rounded-lg border border-amber-600/40 bg-amber-900/20 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-amber-300/90">Botin encontrado</p>
                      <h4 className="mt-1 font-[var(--font-cinzel)] text-xl text-amber-100">
                        {game.pendingDrop.name}
                      </h4>
                      <p className="text-sm text-stone-300">
                        Rareza: {game.pendingDrop.rarity} — guardado en inventario
                      </p>
                      {game.pendingDrop.image && (
                        <div className="mt-3 overflow-hidden rounded-lg border border-amber-700/30 bg-stone-950/70">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={resolveItemImage(game.pendingDrop.image)}
                            alt={game.pendingDrop.name}
                            className="h-40 w-full object-contain p-3"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <Button onClick={handleContinue} className="w-full">
                    Continuar al siguiente turno
                  </Button>
                </div>
              )}

              {game.phase === "finished" && (
                <div className="space-y-4 rounded-lg border border-amber-700/25 bg-stone-900/60 p-5 text-center">
                  <Swords className="mx-auto h-10 w-10 text-amber-300" />
                  <h3 className="font-[var(--font-cinzel)] text-3xl text-amber-100">Fin de la partida</h3>
                  {game.retirementReason && (
                    <p className="text-stone-300">{getRetirementMessage(game.retirementReason)}</p>
                  )}
                  <p className="text-sm text-stone-400">
                    Jugaste {Math.max(0, game.turnIndex - 1)} turnos · Edad final: {game.player.age} años
                  </p>

                  <div className="mx-auto grid max-w-md gap-3 text-left text-sm">
                    <div className="flex items-center justify-between rounded-md border border-amber-700/20 bg-stone-950/50 px-4 py-2">
                      <span className="text-stone-400">Enemigos derrotados</span>
                      <span className="font-semibold text-amber-100">{game.campaignStats.enemiesKilled}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-amber-700/20 bg-stone-950/50 px-4 py-2">
                      <span className="text-stone-400">Oro acumulado</span>
                      <span className="font-semibold text-amber-100">{game.campaignStats.goldEarned}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-amber-700/20 bg-stone-950/50 px-4 py-2">
                      <span className="text-stone-400">Daño maximo en un golpe</span>
                      <span className="font-semibold text-amber-100">{game.campaignStats.maxDamageDealt}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-amber-700/20 bg-stone-950/50 px-4 py-2">
                      <span className="text-stone-400">Reputacion alcanzada</span>
                      <span className="font-semibold text-amber-100">
                        {reputationProgress?.rankName ?? "Desconocido"} (rango {game.player.reputacionNivel})
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg border border-amber-500/35 bg-amber-950/25 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-amber-300/80">Puntaje final</p>
                    <p className="font-[var(--font-cinzel)] text-4xl text-amber-100">{game.finalScore ?? 0}</p>
                  </div>

                  {game.puntajeSubmitted ? (
                    <p className="text-sm text-emerald-400">Puntaje guardado en la tabla de clasificacion.</p>
                  ) : puntajeSubmitError ? (
                    <p className="text-sm text-red-400">{puntajeSubmitError}</p>
                  ) : (
                    <p className="text-sm text-stone-400">Guardando puntaje...</p>
                  )}

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      type="button"
                      onClick={() => {
                        if (game.finalScore === null) {
                          return;
                        }
                        shareViaWhatsApp(
                          buildPersonalScoreShareText({
                            heroName: game.player.name,
                            finalScore: game.finalScore,
                            enemiesKilled: game.campaignStats.enemiesKilled,
                            goldEarned: game.campaignStats.goldEarned,
                            maxDamageDealt: game.campaignStats.maxDamageDealt,
                            reputationRank: game.player.reputacionNivel,
                            reputationRankName: reputationProgress?.rankName ?? "Desconocido"
                          })
                        );
                      }}
                      className="bg-emerald-700 hover:bg-emerald-600"
                    >
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Compartir por WhatsApp
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        if (game.finalScore === null) {
                          return;
                        }
                        shareViaTelegram(
                          buildPersonalScoreShareText({
                            heroName: game.player.name,
                            finalScore: game.finalScore,
                            enemiesKilled: game.campaignStats.enemiesKilled,
                            goldEarned: game.campaignStats.goldEarned,
                            maxDamageDealt: game.campaignStats.maxDamageDealt,
                            reputationRank: game.player.reputacionNivel,
                            reputationRankName: reputationProgress?.rankName ?? "Desconocido"
                          })
                        );
                      }}
                      className="bg-sky-700 hover:bg-sky-600"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Compartir por Telegram
                    </Button>
                  </div>

                  <Button type="button" variant="secondary" className="w-full" onClick={() => router.push("/puntajes")}>
                    <Trophy className="mr-2 h-4 w-4" />
                    Ver tabla de puntajes
                  </Button>

                  <div className="grid gap-2 md:grid-cols-2">
                    <Button onClick={handleResetCampaign} variant="secondary">
                      Jugar campania otra vez
                    </Button>
                    <Button onClick={() => router.push("/")}>Volver al inicio</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <aside className="md:col-span-3 md:flex">
          <Card className="flex h-full min-h-[calc(100vh-3rem)] w-full flex-col border-amber-800/45 bg-stone-950/85 backdrop-blur-md">
            <CardHeader className="pb-2 text-center">
              <CardTitle className="font-[var(--font-cinzel)] text-xl tracking-[0.2em] text-amber-100">
                EQUIPO
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col space-y-4 text-sm">
              <div className="grid grid-cols-3 gap-1.5">
                {EQUIPMENT_LAYOUT.map((slot) => {
                  if (slot.span === "hidden") {
                    return <div key={slot.key} aria-hidden className="h-14" />;
                  }

                  const equippedItem = getEquippedItemForSlot(slot.key);

                  return (
                    <button
                      type="button"
                      key={slot.key}
                      onClick={() => handleEquipmentSlotClick(slot.key)}
                      disabled={!equippedItem}
                      className={`group relative flex h-14 flex-col items-center justify-center rounded-md border px-1 text-center transition ${
                        equippedItem
                          ? "border-amber-500/35 bg-amber-950/25 hover:bg-amber-950/45"
                          : "cursor-default border-amber-700/20 bg-stone-900/70"
                      }`}
                    >
                      <p className="text-[10px] text-stone-400">{slot.label}</p>
                      {equippedItem ? (
                        <>
                          {equippedItem.image ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={resolveItemImage(equippedItem.image)}
                                alt={equippedItem.name}
                                className="my-0.5 h-6 w-6 object-contain"
                              />
                            </>
                          ) : null}
                          <p className="line-clamp-1 text-[10px] text-amber-100">{equippedItem.name}</p>
                        </>
                      ) : (
                        <p className="line-clamp-2 text-[10px] text-stone-300">Vacio</p>
                      )}
                      {equippedItem ? (
                        <span className="pointer-events-none absolute bottom-[calc(100%+0.5rem)] left-1/2 z-20 hidden w-48 -translate-x-1/2 rounded-lg border border-amber-500/35 bg-stone-950/90 p-2 text-left shadow-lg shadow-black/40 backdrop-blur-sm group-hover:block group-focus-visible:block">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200">
                            Click para desequipar
                          </p>
                          {getItemEffectLines(equippedItem.effects).length > 0 && (
                            <ul className="mt-1 border-t border-amber-700/30 pt-1 text-[11px]">
                              {getItemEffectLines(equippedItem.effects).map((effect) => (
                                <li
                                  key={`${slot.key}-${effect.key}`}
                                  className={effect.value > 0 ? "text-emerald-300" : "text-red-300"}
                                >
                                  {effect.value > 0 ? "+" : ""}
                                  {effect.value} {effect.label}
                                </li>
                              ))}
                            </ul>
                          )}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-amber-700/25 pt-3">
                <p className="mb-2 text-center text-[10px] uppercase tracking-[0.2em] text-amber-300/80">
                  Inventario
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {game.player.inventory.map((itemId, slotIndex) => {
                    const storedItem = itemId ? findItemById(itemCatalog, itemId) : null;

                    return (
                      <button
                        type="button"
                        key={`inventory-slot-${slotIndex}`}
                        onClick={() => handleInventoryItemClick(slotIndex)}
                        disabled={!storedItem}
                        className={`group relative flex aspect-square flex-col items-center justify-center rounded-md border p-1 text-center transition ${
                          storedItem
                            ? "border-amber-700/20 bg-stone-900/70 hover:border-amber-500/40 hover:bg-stone-900"
                            : "cursor-default border-amber-700/20 bg-stone-900/70"
                        }`}
                      >
                        {storedItem ? (
                          <>
                            {storedItem.image ? (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={resolveItemImage(storedItem.image)}
                                  alt={storedItem.name}
                                  className="h-8 w-8 object-contain"
                                />
                              </>
                            ) : null}
                            <p className="line-clamp-2 text-[9px] leading-tight text-amber-100">{storedItem.name}</p>
                            <span className="pointer-events-none absolute bottom-[calc(100%+0.5rem)] left-1/2 z-20 hidden w-48 -translate-x-1/2 rounded-lg border border-amber-500/35 bg-stone-950/90 p-2 text-left shadow-lg shadow-black/40 backdrop-blur-sm group-hover:block group-focus-visible:block">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200">
                                {isConsumableItem(storedItem)
                                  ? "Click para consumir"
                                  : `Click para equipar en ${storedItem.slot}`}
                              </p>
                              {getItemEffectLines(storedItem.effects).length > 0 && (
                                <ul className="mt-1 border-t border-amber-700/30 pt-1 text-[11px]">
                                  {getItemEffectLines(storedItem.effects).map((effect) => (
                                    <li
                                      key={`${slotIndex}-${effect.key}`}
                                      className={effect.value > 0 ? "text-emerald-300" : "text-red-300"}
                                    >
                                      {effect.value > 0 ? "+" : ""}
                                      {effect.value} {effect.label}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </span>
                          </>
                        ) : (
                          <p className="text-[10px] text-stone-500">—</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      {levelXpTableOpen && experienceProgress && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-sm"
          onClick={() => setLevelXpTableOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="level-xp-table-title"
            className="flex max-h-[min(36rem,85vh)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-amber-800/50 bg-stone-950 shadow-2xl shadow-black/50"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-amber-800/35 px-4 py-3">
              <div>
                <h2
                  id="level-xp-table-title"
                  className="font-[var(--font-cinzel)] text-lg text-amber-100"
                >
                  Experiencia por nivel
                </h2>
                <p className="mt-0.5 text-xs text-stone-400">
                  Cada nivel cuesta un 15% mas que el anterior. Tu nivel actual:{" "}
                  {experienceProgress.level}.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 shrink-0 p-0 text-stone-400 hover:bg-stone-900 hover:text-amber-100"
                onClick={() => setLevelXpTableOpen(false)}
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-stone-950 text-[10px] uppercase tracking-[0.14em] text-amber-300/80">
                  <tr>
                    <th className="px-3 py-2 font-medium">Nivel</th>
                    <th className="px-3 py-2 font-medium">Siguiente</th>
                    <th className="px-3 py-2 text-right font-medium">XP necesaria</th>
                  </tr>
                </thead>
                <tbody>
                  {HERO_LEVEL_XP_TABLE.map((entry) => {
                    const isCurrent = entry.level === experienceProgress.level;

                    return (
                      <tr
                        key={entry.level}
                        ref={isCurrent ? currentLevelRowRef : undefined}
                        className={
                          isCurrent
                            ? "bg-amber-900/35 text-amber-100"
                            : "text-stone-300 odd:bg-stone-900/40"
                        }
                      >
                        <td className="px-3 py-1.5 tabular-nums">{entry.level}</td>
                        <td className="px-3 py-1.5 tabular-nums">{entry.nextLevel}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {entry.xpToNext.toLocaleString("es-ES")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {reputationRankTableOpen && reputationProgress && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/70 p-4 backdrop-blur-sm"
          onClick={() => setReputationRankTableOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reputation-rank-table-title"
            className="flex max-h-[min(36rem,85vh)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-violet-800/50 bg-stone-950 shadow-2xl shadow-black/50"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-violet-800/35 px-4 py-3">
              <div>
                <h2
                  id="reputation-rank-table-title"
                  className="font-[var(--font-cinzel)] text-lg text-violet-100"
                >
                  Reconocimientos
                </h2>
                <p className="mt-0.5 text-xs text-stone-400">
                  Cada rango cuesta un 25% mas que el anterior. Tu status actual:{" "}
                  <span className="text-violet-300">{reputationProgress.rankName}</span>.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 shrink-0 p-0 text-stone-400 hover:bg-stone-900 hover:text-violet-100"
                onClick={() => setReputationRankTableOpen(false)}
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-stone-950 text-[10px] uppercase tracking-[0.14em] text-violet-300/80">
                  <tr>
                    <th className="px-3 py-2 font-medium">Rango</th>
                    <th className="px-3 py-2 font-medium">Reconocimiento</th>
                    <th className="px-3 py-2 font-medium">Siguiente</th>
                    <th className="px-3 py-2 text-right font-medium">Rep. necesaria</th>
                  </tr>
                </thead>
                <tbody>
                  {REPUTATION_RANK_XP_TABLE.map((entry) => {
                    const isCurrent = entry.rank === reputationProgress.rank;

                    return (
                      <tr
                        key={entry.rank}
                        ref={isCurrent ? currentReputationRowRef : undefined}
                        className={
                          isCurrent
                            ? "bg-violet-900/35 text-violet-100"
                            : "text-stone-300 odd:bg-stone-900/40"
                        }
                      >
                        <td className="px-3 py-1.5 tabular-nums">{entry.rank}</td>
                        <td className="px-3 py-1.5">{entry.rankName}</td>
                        <td className="px-3 py-1.5">{entry.nextRankName}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums">
                          {entry.xpToNext.toLocaleString("es-ES")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
