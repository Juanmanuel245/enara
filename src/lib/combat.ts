import type { Enemigo } from "@/lib/enemigos";
import { findItemById, sumItemEffects, type GameItem } from "@/lib/items";
import { applyExperienceGain, applyReputationGain, getEquippedItemIds, type HeroStats, type PlayerProfile } from "@/lib/player";

export type CombatAction = "attack" | "defend" | "flee";

export type CombatStatus = "active" | "won" | "lost" | "fled";

export type CombatState = {
  enemyVida: number;
  enemyVidaMax: number;
  log: string[];
  status: CombatStatus;
  rounds: number;
  heroDamageDone: number;
  enemyDamageDone: number;
};

export type CombatGearBonuses = {
  weaponDano: number;
  weaponDefensa: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const rollChance = (percent: number) => Math.random() * 100 < clamp(percent, 0, 100);

export const getEquippedItems = (player: PlayerProfile, items: GameItem[]) =>
  getEquippedItemIds(player.equipment)
    .map((itemId) => findItemById(items, itemId))
    .filter((item): item is GameItem => item !== null);

export const getEffectiveHeroStats = (player: PlayerProfile, items: GameItem[]): HeroStats => {
  const equipmentEffects = sumItemEffects(getEquippedItems(player, items));
  const next: HeroStats = { ...player.stats };

  (Object.keys(equipmentEffects) as (keyof HeroStats)[]).forEach((key) => {
    const value = equipmentEffects[key];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return;
    }
    if (key === "dano") {
      next.fuerza += value;
      return;
    }
    if (key === "vidaMax") {
      next.vidaMax = clamp(next.vidaMax + value, 1, 999);
      return;
    }
    next[key] = next[key] + value;
  });

  next.vida = clamp(next.vida, 1, next.vidaMax);
  next.fuerza = clamp(next.fuerza, 1, 30);
  next.carisma = clamp(next.carisma, 1, 30);
  next.agilidad = clamp(next.agilidad, 1, 30);
  next.suerte = clamp(next.suerte, 1, 30);
  next.defensa = clamp(next.defensa, 0, 30);
  next.dano = 0;

  return next;
};

export const getCombatGearFromEquipment = (
  player: PlayerProfile,
  items: Pick<GameItem, "id" | "effects">[]
): CombatGearBonuses => {
  const equipped = getEquippedItemIds(player.equipment)
    .map((itemId) => items.find((item) => item.id === itemId) ?? null)
    .filter((item): item is Pick<GameItem, "id" | "effects"> => item !== null);

  const totals = sumItemEffects(equipped);

  return {
    weaponDano: totals.dano ?? 0,
    weaponDefensa: totals.defensa ?? 0
  };
};

/** Ataque del heroe: (fuerza + daño de arma) * nivel. Critico usa probCritico / danoCritico. */
export const calcHeroRawDamage = (player: PlayerProfile, weaponDano: number) => {
  const arma = Math.max(0, weaponDano);
  const base = player.stats.fuerza + arma;
  return Math.max(1, base * Math.max(1, player.nivel));
};

/** Valor mostrado en la UI como stat "Daño". */
export const calcHeroAttackPower = (player: PlayerProfile, weaponDano: number) =>
  calcHeroRawDamage(player, weaponDano);

/** Ataque del enemigo: ataque * nivel (pedido del diseno). */
export const calcEnemyRawDamage = (enemy: Enemigo) =>
  Math.max(1, enemy.ataque * Math.max(1, enemy.nivel));

/** Esquiva/bloqueo del enemigo: valores bajos (0-5) -> % (x10, tope 45). */
export const enemyAvoidChance = (value: number) => clamp(value * 10, 0, 45);

export const createCombatState = (enemy: Enemigo): CombatState => ({
  enemyVida: enemy.vida,
  enemyVidaMax: enemy.vida,
  log: [`¡${enemy.nombre} aparece! Elegi tu accion.`],
  status: "active",
  rounds: 0,
  heroDamageDone: 0,
  enemyDamageDone: 0
});

const applyDamageToEnemy = (
  player: PlayerProfile,
  enemy: Enemigo,
  combat: CombatState,
  weaponDano: number
) => {
  const log: string[] = [];

  if (rollChance(enemyAvoidChance(enemy.esquiva))) {
    log.push(`${enemy.nombre} esquivo tu ataque.`);
    return { combat, log, killed: false };
  }

  let raw = calcHeroRawDamage(player, weaponDano);
  const crit = rollChance(player.secondaryStats.probCritico);
  if (crit) {
    raw = Math.round((raw * player.secondaryStats.danoCritico) / 100);
  }

  if (rollChance(enemyAvoidChance(enemy.bloqueo))) {
    raw = Math.max(1, Math.round(raw * 0.5));
    log.push(`${enemy.nombre} bloqueo parte del golpe.`);
  }

  const damage = Math.max(1, raw - enemy.defensa);
  const enemyVida = Math.max(0, combat.enemyVida - damage);
  log.push(
    crit
      ? `Golpe critico: infligis ${damage} de daño.`
      : `Atacas e infligis ${damage} de daño.`
  );

  return {
    combat: {
      ...combat,
      enemyVida,
      heroDamageDone: combat.heroDamageDone + damage
    },
    log,
    killed: enemyVida <= 0
  };
};

const applyDamageToHero = (
  player: PlayerProfile,
  enemy: Enemigo,
  combat: CombatState,
  gear: CombatGearBonuses,
  defending: boolean
) => {
  const log: string[] = [];
  const dodgeChance =
    player.secondaryStats.probEsquivar + (defending ? Math.floor(player.stats.agilidad / 2) : 0);

  if (rollChance(dodgeChance)) {
    log.push(`Esquivas el ataque de ${enemy.nombre}.`);
    return { player, combat, log, defeated: false };
  }

  let raw = calcEnemyRawDamage(enemy);
  const blockChance =
    player.secondaryStats.probBloqueo + (defending ? 25 + player.stats.defensa : 0);

  if (rollChance(blockChance)) {
    raw = Math.max(1, Math.round(raw * 0.5));
    log.push("Bloqueas parte del golpe.");
  }

  const mitigation =
    Math.floor(player.stats.defensa * (defending ? 1.1 : 0.55)) +
    Math.floor(gear.weaponDefensa * (defending ? 1 : 0.5));
  const damage = Math.max(1, raw - mitigation);
  const vida = Math.max(0, player.stats.vida - damage);

  log.push(
    defending
      ? `${enemy.nombre} ataca mientras te defendes: recibis ${damage} de daño.`
      : `${enemy.nombre} ataca y te hace ${damage} de daño.`
  );

  return {
    player: {
      ...player,
      stats: {
        ...player.stats,
        vida
      }
    },
    combat: {
      ...combat,
      enemyDamageDone: combat.enemyDamageDone + damage
    },
    log,
    defeated: vida <= 0
  };
};

export const resolveFleeChance = (player: PlayerProfile, enemy: Enemigo) =>
  clamp(20 + player.stats.agilidad * 2 + player.stats.suerte - enemy.nivel * 5, 8, 80);

export const resolveCombatTurn = ({
  action,
  player,
  enemy,
  combat,
  gear
}: {
  action: CombatAction;
  player: PlayerProfile;
  enemy: Enemigo;
  combat: CombatState;
  gear: CombatGearBonuses;
}): { player: PlayerProfile; combat: CombatState } => {
  if (combat.status !== "active") {
    return { player, combat };
  }

  let nextPlayer = player;
  let nextCombat: CombatState = {
    ...combat,
    rounds: combat.rounds + 1
  };
  const turnLog: string[] = [];

  if (action === "flee") {
    const chance = resolveFleeChance(player, enemy);
    if (rollChance(chance)) {
      turnLog.push(`Escapas del combate (${chance}% de exito).`);
      return {
        player: nextPlayer,
        combat: {
          ...nextCombat,
          status: "fled",
          log: [...combat.log, ...turnLog].slice(-12)
        }
      };
    }

    turnLog.push(`Fallaste la huida (${chance}% de exito).`);
  } else if (action === "attack") {
    const attackResult = applyDamageToEnemy(player, enemy, nextCombat, gear.weaponDano);
    nextCombat = attackResult.combat;
    turnLog.push(...attackResult.log);

    if (attackResult.killed) {
      turnLog.push(`Derrotaste a ${enemy.nombre}.`);
      return {
        player: nextPlayer,
        combat: {
          ...nextCombat,
          status: "won",
          log: [...combat.log, ...turnLog].slice(-12)
        }
      };
    }
  } else {
    turnLog.push("Te pones en guardia. Mitigas mejor el proximo golpe.");
  }

  const enemyStrike = applyDamageToHero(
    nextPlayer,
    enemy,
    nextCombat,
    gear,
    action === "defend"
  );
  nextPlayer = enemyStrike.player;
  nextCombat = enemyStrike.combat;
  turnLog.push(...enemyStrike.log);

  if (enemyStrike.defeated) {
    turnLog.push(`Fuiste derrotado por ${enemy.nombre}.`);
    nextPlayer = {
      ...nextPlayer,
      stats: {
        ...nextPlayer.stats,
        vida: 1
      }
    };
    nextCombat = {
      ...nextCombat,
      status: "lost",
      log: [...combat.log, ...turnLog].slice(-12)
    };
    return { player: nextPlayer, combat: nextCombat };
  }

  return {
    player: nextPlayer,
    combat: {
      ...nextCombat,
      log: [...combat.log, ...turnLog].slice(-12)
    }
  };
};

export const applyVictoryRewards = (player: PlayerProfile, enemy: Enemigo): PlayerProfile => {
  const leveled = applyExperienceGain(player.nivel, player.experiencia, enemy.experiencia);
  const ranked = applyReputationGain(player.reputacionNivel, player.stats.reputacion, enemy.reputacion);

  return {
    ...player,
    nivel: leveled.nivel,
    experiencia: leveled.experiencia,
    reputacionNivel: ranked.reputacionNivel,
    stats: {
      ...player.stats,
      reputacion: ranked.reputacion
    }
  };
};
