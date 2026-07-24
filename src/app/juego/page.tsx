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
  Shield,
  ShieldHalf,
  Sun,
  Sunset,
  Wind,
  Sparkles,
  Sword,
  Swords,
  Users,
  Zap
} from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchWeaponItems, getLocalWeaponItems, normalizeWeaponItem, type WeaponItem } from "@/lib/items";
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
  createCombatState,
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
  getHeroExperienceProgress,
  getReputationProgress,
  MAX_ENERGIA,
  GAME_STORAGE_KEY,
  PLAYER_STORAGE_KEY,
  type HeroStats,
  type PlayerProfile,
  formatEquipmentSlotLabel,
  parseStoredPlayer
} from "@/lib/player";

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
};

type StageMessage = {
  stage: 2 | 3;
  text: string;
  recovered?: {
    vida: number;
    energia: number;
  };
};

type GamePhase =
  | "lifeMission"
  | "missionResult"
  | "dayStage2"
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
  pendingDrop: WeaponItem | null;
  pendingEnemy: Enemigo | null;
  pendingEncounterChoice: DayStage3EncounterChoice | null;
  combat: CombatState | null;
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
  dano: "Dano",
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
    return `${sign}${value} ${statLabels[key]}`;
  });
};

const applyOptionEffects = (stats: HeroStats, effects: Partial<Record<keyof HeroStats, number>>) => {
  const next: HeroStats = { ...stats };

  (Object.keys(effects) as (keyof HeroStats)[]).forEach((key) => {
    next[key] = next[key] + (effects[key] ?? 0);
  });

  return {
    fuerza: clamp(next.fuerza, 1, 30),
    carisma: clamp(next.carisma, 1, 30),
    agilidad: clamp(next.agilidad, 1, 30),
    suerte: clamp(next.suerte, 1, 30),
    reputacion: Math.max(0, next.reputacion),
    vida: clamp(next.vida, 1, next.vidaMax),
    vidaMax: next.vidaMax,
    dano: clamp(next.dano, 0, 30),
    defensa: clamp(next.defensa, 0, 30)
  } satisfies HeroStats;
};

const applyRestRecovery = (player: PlayerProfile) => {
  const vidaPercent = randomBetween(5, 20);
  const energiaPercent = randomBetween(25, 50);
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
      (parsedStageMessage.stage === 2 || parsedStageMessage.stage === 3) &&
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
      pendingDrop: normalizeWeaponItem(parsed.pendingDrop),
      pendingEnemy,
      pendingEncounterChoice: normalizedEncounterChoice,
      combat:
        normalizedPhase === "enemyEncounter"
          ? normalizeCombatState(parsed.combat, pendingEnemy)
          : null
    } satisfies GameState;
  } catch {
    return null;
  }
};

export default function GamePage() {
  const router = useRouter();
  const combatLogRef = useRef<HTMLUListElement>(null);
  const [weaponItems, setWeaponItems] = useState<WeaponItem[]>(() => getLocalWeaponItems());
  const [missionItems, setMissionItems] = useState<Mission[]>(() => getLocalMissions());
  const [enemigoItems] = useState<Enemigo[]>(() => getLocalEnemigos());
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
      combat: null
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
      const loaded = await fetchWeaponItems();
      if (!active) {
        return;
      }

      setWeaponItems(loaded);
    };

    void loadItems();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const logEl = combatLogRef.current;
    if (logEl) {
      logEl.scrollTop = logEl.scrollHeight;
    }
  }, [game?.combat?.log]);

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

  const heroPrimaryStats = game
    ? [
        { label: "Fuerza", value: game.player.stats.fuerza, Icon: Swords },
        { label: "Agilidad", value: game.player.stats.agilidad, Icon: Footprints },
        { label: "Carisma", value: game.player.stats.carisma, Icon: Users },
        { label: "Suerte", value: game.player.stats.suerte, Icon: Clover }
      ]
    : [];

  const heroCombatStats = game
    ? [
        { label: "Dano", value: game.player.stats.dano, Icon: Sword },
        { label: "Defensa", value: game.player.stats.defensa, Icon: Shield }
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
          label: "Dano critico",
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
  const equippedMainHandItem = weaponItems.find((item) => item.name === game?.player.equipment.mano_principal);
  const equippedOffHandItem = weaponItems.find((item) => item.name === game?.player.equipment.mano_secundaria);

  const vidaPercent = game
    ? Math.min(100, Math.max(0, (game.player.stats.vida / game.player.stats.vidaMax) * 100))
    : 0;
  const energiaPercent = game ? Math.min(100, Math.max(0, (game.player.energia / MAX_ENERGIA) * 100)) : 0;
  const reputationProgress = game ? getReputationProgress(game.player.stats.reputacion) : null;
  const experienceProgress = game
    ? getHeroExperienceProgress(game.player.experiencia, game.player.nivel)
    : null;
  const currentDayStage: 1 | 2 | 3 = game
    ? game.phase === "dayStage2"
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

  const resolveNextPhaseAfterTurn = (gameState: GameState): GameState["phase"] => {
    const nextLifeMissionIndex = gameState.lifeMissionIndex + 1;
    const shouldFinish = nextLifeMissionIndex >= eligibleLifeMissions.length;
    return shouldFinish ? "finished" : "lifeMission";
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
      age: Math.min(99, updatedPlayer.age + 1)
    };

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
      turnIndex: game.turnIndex + 1,
      lifeMissionIndex: game.lifeMissionIndex + 1,
      situationMissionIndex: game.situationMissionIndex + 1
    } satisfies GameState;

    persistGame({
      ...intermediateGame,
      phase: resolveNextPhaseAfterTurn(game)
    });
  };

  const handleMissionChoice = (option: MissionOption, mission: Mission) => {
    if (!game) {
      return;
    }

    const statsAfterChoice = applyOptionEffects(game.player.stats, option.effects);
    const updatedPlayer: PlayerProfile = { ...game.player, stats: statsAfterChoice };

    persistGame({
      ...game,
      player: updatedPlayer,
      phase: "missionResult",
      lastBattle: null,
      lastStageMessage: null,
      pendingDrop: null,
      lastMissionChoice: {
        missionTitle: mission.title,
        missionType: mission.type,
        selectedOptionText: option.text,
        response: option.response,
        effects: option.effects
      }
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

    if (choice === "shop") {
      persistGame({
        ...game,
        phase: "stageMessage",
        lastBattle: null,
        lastMissionChoice: null,
        lastStageMessage: {
          stage: 2,
          text: "Pasaste a saludar por la tienda"
        },
        pendingDrop: null
      });
      return;
    }

    if (choice === "work") {
      persistGame({
        ...game,
        phase: "stageMessage",
        lastBattle: null,
        lastMissionChoice: null,
        lastStageMessage: {
          stage: 2,
          text: "Te pusiste a trabajar"
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

    persistGame({
      ...game,
      phase: "enemyEncounter",
      lastBattle: null,
      lastMissionChoice: null,
      lastStageMessage: null,
      pendingDrop: null,
      pendingEnemy: selectedEnemy,
      pendingEncounterChoice: choice,
      combat: createCombatState(selectedEnemy)
    });
  };

  const handleCombatAction = (action: CombatAction) => {
    if (!game?.pendingEnemy || !game.combat || game.combat.status !== "active") {
      return;
    }

    const weaponDano =
      (equippedMainHandItem?.effects.dano ?? 0) + (equippedOffHandItem?.effects.dano ?? 0);
    const weaponDefensa =
      (equippedMainHandItem?.effects.defensa ?? 0) + (equippedOffHandItem?.effects.defensa ?? 0);

    const result = resolveCombatTurn({
      action,
      player: game.player,
      enemy: game.pendingEnemy,
      combat: game.combat,
      gear: { weaponDano, weaponDefensa }
    });

    const rewardedPlayer =
      result.combat.status === "won"
        ? applyVictoryRewards(result.player, game.pendingEnemy)
        : result.player;

    persistGame({
      ...game,
      player: rewardedPlayer,
      combat: result.combat
    });
  };

  const handleFinishEnemyEncounter = () => {
    if (!game?.combat || game.combat.status === "active") {
      return;
    }

    advanceTurn(game.player, null);
  };

  const handleContinueStageMessage = () => {
    if (!game?.lastStageMessage) {
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

  const handleEquipDroppedWeapon = () => {
    if (!game?.pendingDrop) {
      return;
    }

    const dropped = game.pendingDrop;
    const updatedPlayer: PlayerProfile = {
      ...game.player,
      equipment:
        dropped.slot === "mano_principal"
          ? { ...game.player.equipment, mano_principal: dropped.name }
          : { ...game.player.equipment, mano_secundaria: dropped.name }
    };

    persistGame({
      ...game,
      player: updatedPlayer,
      pendingDrop: null
    });
  };

  const handleSellDroppedWeapon = () => {
    if (!game?.pendingDrop) {
      return;
    }

    const updatedPlayer: PlayerProfile = {
      ...game.player,
      coins: game.player.coins + game.pendingDrop.cost
    };

    persistGame({
      ...game,
      player: updatedPlayer,
      pendingDrop: null
    });
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
      combat: null
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
                  Nivel {experienceProgress.level}
                </p>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full border border-amber-900/40 bg-stone-950">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-800 to-amber-400 transition-[width]"
                    style={{ width: `${experienceProgress.progressPercent}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] tabular-nums text-stone-400">
                  {experienceProgress.currentXp}/{experienceProgress.xpToNextLevel} XP
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
                      {game.player.stats.vida}/{game.player.stats.vidaMax}
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
                          Reputacion
                        </span>
                        <span className="text-[10px] font-normal uppercase tracking-[0.08em] text-amber-300/80">
                          {reputationProgress.rankName}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums text-stone-300">
                        {reputationProgress.currentXp}/{reputationProgress.xpToNextRank}
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
              className="mt-4 w-full border border-red-900/45 bg-red-950/25 text-red-100 hover:bg-red-950/45"
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
                </div>
              )}

              {game.phase === "lifeMission" && !currentLifeMission && (
                <div className="space-y-4 rounded-lg border border-amber-700/25 bg-stone-900/60 p-5 text-center">
                  <h3 className="font-[var(--font-cinzel)] text-2xl text-amber-100">Sin mision de vida elegible</h3>
                  <p className="text-stone-300">
                    No hay una mision disponible para tu nivel/reputacion en este turno.
                  </p>
                  <Button onClick={handleSkipMissingMission} className="w-full">
                    Continuar
                  </Button>
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
                      Decidi tu actividad
                    </h3>
                    <p className="mt-2 text-stone-300">Elegi si queres pasar por la tienda, descansar o trabajar.</p>
                  </div>
                  <div className="grid gap-3">
                    <Button
                      type="button"
                      variant="secondary"
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
                      className="h-auto justify-start whitespace-normal border border-amber-700/30 bg-stone-800/80 py-3 text-left text-stone-100 hover:bg-stone-700"
                      onClick={() => handleDayStage2Choice("work")}
                    >
                      Trabajar
                    </Button>
                  </div>
                </div>
              )}

              {game.phase === "dayStage3" && (
                <div className="space-y-4">
                  <div className="rounded-lg border border-amber-700/25 bg-stone-900/60 p-4">
                    <p className="mb-1 text-xs uppercase tracking-[0.2em] text-amber-300/80">Dia {game.turnIndex} - Etapa 3</p>
                    <h3 className="font-[var(--font-cinzel)] text-2xl text-amber-100">Elegi tu accion final del dia</h3>
                    <p className="mt-2 text-stone-300">La accion que tomes define el cierre de la jornada.</p>
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
                      className="h-auto justify-start whitespace-normal border border-amber-700/30 bg-stone-800/80 py-3 text-left text-stone-100 hover:bg-stone-700"
                      onClick={() => handleDayStage3Choice("defend")}
                    >
                      Defender los caminos
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="h-auto justify-start whitespace-normal border border-amber-700/30 bg-stone-800/80 py-3 text-left text-stone-100 hover:bg-stone-700"
                      onClick={() => handleDayStage3Choice("cave")}
                    >
                      Ingresar a cueva
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
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
                          ? "Fuiste derrotado. Sobrevivis con 1 de vida."
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
                            className="h-64 w-full object-cover"
                          />
                        </>
                      ) : (
                        <div className="flex h-64 items-center justify-center bg-stone-900/80 text-stone-400">
                          Sin imagen
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-stone-950/95 via-stone-950/80 to-transparent px-3 pb-3 pt-8">
                        <div className="mb-1 flex items-center justify-between text-xs text-stone-200">
                          <span className="flex items-center gap-1.5 font-medium text-amber-100">
                            <HeartPulse className="h-3.5 w-3.5 text-red-400" />
                            Vida
                          </span>
                          <span className="tabular-nums text-stone-300">
                            {game.combat?.enemyVida ?? game.pendingEnemy.vida}/
                            {game.combat?.enemyVidaMax ?? game.pendingEnemy.vida}
                          </span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full border border-amber-900/40 bg-stone-950/90">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-red-700 to-red-500 transition-[width]"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(
                                  0,
                                  ((game.combat?.enemyVida ?? game.pendingEnemy.vida) /
                                    (game.combat?.enemyVidaMax ?? game.pendingEnemy.vida)) *
                                    100
                                )
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
                    <Button onClick={handleFinishEnemyEncounter} className="w-full">
                      Continuar
                    </Button>
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
                  </div>
                  <div className="rounded-lg border border-amber-600/35 bg-amber-950/20 p-4 text-sm text-stone-100">
                    {game.lastStageMessage.stage === 2
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
                        Rareza: {game.pendingDrop.rarity} - Valor de venta: {game.pendingDrop.cost} monedas
                      </p>
                      {game.pendingDrop.image && (
                        <div className="mt-3 overflow-hidden rounded-lg border border-amber-700/30 bg-stone-950/70">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={game.pendingDrop.image}
                            alt={game.pendingDrop.name}
                            className="h-40 w-full object-contain p-3"
                          />
                        </div>
                      )}
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <Button type="button" variant="secondary" onClick={handleEquipDroppedWeapon}>
                          Quedarsela y equipar
                        </Button>
                        <Button type="button" onClick={handleSellDroppedWeapon}>
                          Vender por {game.pendingDrop.cost} monedas
                        </Button>
                      </div>
                    </div>
                  )}

                  {!game.pendingDrop && (
                    <Button onClick={handleContinue} className="w-full">
                      Continuar al siguiente turno
                    </Button>
                  )}
                </div>
              )}

              {game.phase === "finished" && (
                <div className="space-y-4 rounded-lg border border-amber-700/25 bg-stone-900/60 p-5 text-center">
                  <Swords className="mx-auto h-10 w-10 text-amber-300" />
                  <h3 className="font-[var(--font-cinzel)] text-3xl text-amber-100">Tu leyenda ha sido forjada</h3>
                  <p className="text-stone-300">
                    Completaste {game.turnIndex - 1} turnos de aventura y cerraste la campania.
                  </p>
                  <p className="text-stone-200">
                    Reputacion final:{" "}
                    <span className="font-semibold text-amber-200">{game.player.stats.reputacion}</span>
                  </p>
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
                <div className="flex h-14 flex-col items-center justify-center rounded-md border border-amber-700/20 bg-stone-900/70 px-1 text-center">
                  <p className="text-[10px] text-stone-400">Hombrera</p>
                  <p className="text-[11px] text-stone-300">Vacio</p>
                </div>
                <div className="flex h-14 flex-col items-center justify-center rounded-md border border-amber-700/20 bg-stone-900/70 px-1 text-center">
                  <p className="text-[10px] text-stone-400">Casco</p>
                  <p className="text-[11px] text-stone-300">Vacio</p>
                </div>
                <div className="flex h-14 flex-col items-center justify-center rounded-md border border-amber-700/20 bg-stone-900/70 px-1 text-center">
                  <p className="text-[10px] text-stone-400">Capa</p>
                  <p className="text-[11px] text-stone-300">Vacio</p>
                </div>

                <div className="flex h-14 flex-col items-center justify-center rounded-md border border-amber-700/20 bg-stone-900/70 px-1 text-center">
                  <p className="text-[10px] text-stone-400">Guantes</p>
                  <p className="text-[11px] text-stone-300">Vacio</p>
                </div>
                <div className="flex h-14 flex-col items-center justify-center rounded-md border border-amber-700/20 bg-stone-900/70 px-1 text-center">
                  <p className="text-[10px] text-stone-400">Pechera</p>
                  <p className="text-[11px] text-stone-300">Vacio</p>
                </div>
                <div className="flex h-14 flex-col items-center justify-center rounded-md border border-amber-700/20 bg-stone-900/70 px-1 text-center">
                  <p className="text-[10px] text-stone-400">Brazaletes</p>
                  <p className="text-[11px] text-stone-300">Vacio</p>
                </div>

                <div className="flex h-14 flex-col items-center justify-center rounded-md border border-amber-700/20 bg-stone-900/70 px-1 text-center">
                  <p className="text-[10px] text-amber-300/90">Mano secundaria</p>
                  {equippedOffHandItem?.image ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={equippedOffHandItem.image}
                        alt={equippedOffHandItem.name}
                        className="my-0.5 h-6 w-6 object-contain"
                      />
                      <p className="line-clamp-1 text-[10px] text-amber-100">{equippedOffHandItem.name}</p>
                    </>
                  ) : (
                    <p className="line-clamp-2 text-[10px] text-stone-300">
                      {formatEquipmentSlotLabel(game.player.equipment.mano_secundaria)}
                    </p>
                  )}
                </div>
                <div className="flex h-14 flex-col items-center justify-center rounded-md border border-amber-700/20 bg-stone-900/70 px-1 text-center">
                  <p className="text-[10px] text-stone-400">Cinturon</p>
                  <p className="text-[11px] text-stone-300">Vacio</p>
                </div>
                <div className="flex h-14 flex-col items-center justify-center rounded-md border border-amber-700/20 bg-stone-900/70 px-1 text-center">
                  <p className="text-[10px] text-amber-300/90">Mano principal</p>
                  {equippedMainHandItem?.image ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={equippedMainHandItem.image}
                        alt={equippedMainHandItem.name}
                        className="my-0.5 h-6 w-6 object-contain"
                      />
                      <p className="line-clamp-1 text-[10px] text-amber-100">{equippedMainHandItem.name}</p>
                    </>
                  ) : (
                    <p className="line-clamp-2 text-[10px] text-stone-300">
                      {formatEquipmentSlotLabel(game.player.equipment.mano_principal)}
                    </p>
                  )}
                </div>

                <div aria-hidden className="h-14" />
                <div className="flex h-14 flex-col items-center justify-center rounded-md border border-amber-700/20 bg-stone-900/70 px-1 text-center">
                  <p className="text-[10px] text-stone-400">Pantalon</p>
                  <p className="text-[11px] text-stone-300">Vacio</p>
                </div>
                <div aria-hidden className="h-14" />

                <div aria-hidden className="h-14" />
                <div className="flex h-14 flex-col items-center justify-center rounded-md border border-amber-700/20 bg-stone-900/70 px-1 text-center">
                  <p className="text-[10px] text-stone-400">Botas</p>
                  <p className="text-[11px] text-stone-300">Vacio</p>
                </div>
                <div aria-hidden className="h-14" />
              </div>

              <div className="border-t border-amber-700/25 pt-3">
                <p className="mb-2 text-center text-[10px] uppercase tracking-[0.2em] text-amber-300/80">
                  Inventario
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {game.player.inventory.map((weaponId, slotIndex) => {
                    const storedItem = weaponId ? weaponItems.find((item) => item.id === weaponId) : null;

                    return (
                      <div
                        key={`inventory-slot-${slotIndex}`}
                        className="flex aspect-square flex-col items-center justify-center rounded-md border border-amber-700/20 bg-stone-900/70 p-1 text-center"
                      >
                        {storedItem ? (
                          <>
                            {storedItem.image ? (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={storedItem.image}
                                  alt={storedItem.name}
                                  className="h-8 w-8 object-contain"
                                />
                              </>
                            ) : null}
                            <p className="line-clamp-2 text-[9px] leading-tight text-amber-100">{storedItem.name}</p>
                          </>
                        ) : (
                          <p className="text-[10px] text-stone-500">—</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </main>
  );
}
