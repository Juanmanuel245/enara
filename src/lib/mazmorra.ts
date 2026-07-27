export type DungeonEventType = "nothing" | "enemy" | "gold" | "drop";

export type DungeonDropResolvedAs = "item" | "gold" | "nothing";

export type DungeonStageStatus = "pending" | "current" | "cleared";

export type DungeonChoice = {
  id: number;
  event: DungeonEventType;
  revealed: boolean;
  goldAmount?: number;
  dropItemImage?: string;
  dropItemName?: string;
  dropResolvedAs?: DungeonDropResolvedAs;
  enemyImage?: string;
  enemyName?: string;
};

export type DungeonStage = {
  id: number;
  isFinal: boolean;
  status: DungeonStageStatus;
  event?: DungeonEventType;
  explored: boolean;
  choices: DungeonChoice[];
  goldAmount?: number;
  dropItemImage?: string;
  dropItemName?: string;
  dropResolvedAs?: DungeonDropResolvedAs;
  enemyImage?: string;
  enemyName?: string;
};

export type DungeonExplorationStatus =
  | "active"
  | "stage_cleared"
  | "enemy_found"
  | "completed"
  | "abandoned";

export type DungeonExplorationState = {
  currentStage: number;
  totalStages: number;
  stages: DungeonStage[];
  status: DungeonExplorationStatus;
  log: string[];
};

export const DUNGEON_TOTAL_STAGES = 5;
export const DUNGEON_REGULAR_STAGES = 4;
export const DUNGEON_CHOICES_PER_STAGE = 4;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const randomBetween = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const rollDungeonEvent = (isFinalStage: boolean): DungeonEventType => {
  if (isFinalStage) {
    return "enemy";
  }

  const roll = Math.random() * 100;
  if (roll < 25) {
    return "nothing";
  }
  if (roll < 50) {
    return "gold";
  }
  if (roll < 75) {
    return "drop";
  }
  return "enemy";
};

export const createStageChoices = (isFinalStage: boolean): DungeonChoice[] =>
  Array.from({ length: DUNGEON_CHOICES_PER_STAGE }, (_, id) => {
    const event = rollDungeonEvent(isFinalStage);
    return {
      id,
      event,
      revealed: false,
      goldAmount: event === "gold" ? randomBetween(25, 75) : undefined
    };
  });

const createInitialStages = (): DungeonStage[] =>
  Array.from({ length: DUNGEON_TOTAL_STAGES }, (_, index) => {
    const id = index + 1;
    const isFinal = id === DUNGEON_TOTAL_STAGES;
    return {
      id,
      isFinal,
      status: id === 1 ? "current" : "pending",
      explored: false,
      choices: id === 1 ? createStageChoices(isFinal) : []
    };
  });

export const createDungeonExplorationState = (): DungeonExplorationState => ({
  currentStage: 1,
  totalStages: DUNGEON_TOTAL_STAGES,
  stages: createInitialStages(),
  status: "active",
  log: ["Entraste a la mazmorra. Elige una opcion en cada etapa hasta el jefe final."]
});

const normalizeDungeonChoice = (raw: unknown, fallbackId: number): DungeonChoice | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const choice = raw as Partial<DungeonChoice>;
  const event =
    choice.event === "nothing" ||
    choice.event === "enemy" ||
    choice.event === "gold" ||
    choice.event === "drop"
      ? choice.event
      : "nothing";

  return {
    id: typeof choice.id === "number" ? choice.id : fallbackId,
    event,
    revealed: choice.revealed === true,
    goldAmount:
      typeof choice.goldAmount === "number" && Number.isFinite(choice.goldAmount)
        ? Math.max(0, Math.round(choice.goldAmount))
        : event === "gold"
          ? randomBetween(25, 75)
          : undefined,
    dropItemImage:
      typeof choice.dropItemImage === "string" && choice.dropItemImage.trim().length > 0
        ? choice.dropItemImage.trim()
        : undefined,
    dropItemName:
      typeof choice.dropItemName === "string" && choice.dropItemName.trim().length > 0
        ? choice.dropItemName.trim()
        : undefined,
    dropResolvedAs:
      choice.dropResolvedAs === "item" ||
      choice.dropResolvedAs === "gold" ||
      choice.dropResolvedAs === "nothing"
        ? choice.dropResolvedAs
        : undefined,
    enemyImage:
      typeof choice.enemyImage === "string" && choice.enemyImage.trim().length > 0
        ? choice.enemyImage.trim()
        : undefined,
    enemyName:
      typeof choice.enemyName === "string" && choice.enemyName.trim().length > 0
        ? choice.enemyName.trim()
        : undefined
  };
};

export const normalizeDungeonExplorationState = (raw: unknown): DungeonExplorationState | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const source = raw as Partial<DungeonExplorationState>;
  const totalStages =
    typeof source.totalStages === "number" && Number.isFinite(source.totalStages)
      ? clamp(Math.round(source.totalStages), 5, 5)
      : DUNGEON_TOTAL_STAGES;
  const currentStage =
    typeof source.currentStage === "number" && Number.isFinite(source.currentStage)
      ? clamp(Math.round(source.currentStage), 1, totalStages)
      : 1;

  const status =
    source.status === "active" ||
    source.status === "stage_cleared" ||
    source.status === "enemy_found" ||
    source.status === "completed" ||
    source.status === "abandoned"
      ? source.status
      : "active";

  const rawStages = Array.isArray(source.stages) ? source.stages : [];
  const stages: DungeonStage[] = [];

  for (let index = 0; index < totalStages; index += 1) {
    const stageRaw = rawStages[index];
    if (!stageRaw || typeof stageRaw !== "object") {
      return null;
    }

    const stage = stageRaw as Partial<DungeonStage>;
    const id = index + 1;
    const isFinal = id === totalStages;
    const event =
      stage.event === "nothing" ||
      stage.event === "enemy" ||
      stage.event === "gold" ||
      stage.event === "drop"
        ? stage.event
        : undefined;

    const rawChoices = Array.isArray(stage.choices) ? stage.choices : [];
    let choices: DungeonChoice[] = rawChoices
      .map((choice, choiceIndex) => normalizeDungeonChoice(choice, choiceIndex))
      .filter((choice): choice is DungeonChoice => choice !== null);

    const stageStatus =
      stage.status === "pending" || stage.status === "current" || stage.status === "cleared"
        ? stage.status
        : id < currentStage
          ? "cleared"
          : id === currentStage
            ? "current"
            : "pending";

    const explored = stage.explored === true;

    if (
      choices.length !== DUNGEON_CHOICES_PER_STAGE &&
      stageStatus === "current" &&
      !explored
    ) {
      choices = createStageChoices(isFinal);
    }

    stages.push({
      id,
      isFinal,
      status: stageStatus,
      event,
      explored,
      choices,
      goldAmount:
        typeof stage.goldAmount === "number" && Number.isFinite(stage.goldAmount)
          ? Math.max(0, Math.round(stage.goldAmount))
          : undefined,
      dropItemImage:
        typeof stage.dropItemImage === "string" && stage.dropItemImage.trim().length > 0
          ? stage.dropItemImage.trim()
          : undefined,
      dropItemName:
        typeof stage.dropItemName === "string" && stage.dropItemName.trim().length > 0
          ? stage.dropItemName.trim()
          : undefined,
      dropResolvedAs:
        stage.dropResolvedAs === "item" ||
        stage.dropResolvedAs === "gold" ||
        stage.dropResolvedAs === "nothing"
          ? stage.dropResolvedAs
          : undefined,
      enemyImage:
        typeof stage.enemyImage === "string" && stage.enemyImage.trim().length > 0
          ? stage.enemyImage.trim()
          : undefined,
      enemyName:
        typeof stage.enemyName === "string" && stage.enemyName.trim().length > 0
          ? stage.enemyName.trim()
          : undefined
    });
  }

  const log = Array.isArray(source.log)
    ? source.log.filter((line): line is string => typeof line === "string").slice(-12)
    : ["Entraste a la mazmorra. Elige una opcion en cada etapa hasta el jefe final."];

  return {
    currentStage,
    totalStages,
    stages,
    status,
    log
  };
};

export const getDungeonEventLabel = (event: DungeonEventType): string => {
  switch (event) {
    case "nothing":
      return "Nada";
    case "enemy":
      return "Enemigo";
    case "gold":
      return "Oro";
    case "drop":
      return "Drop";
  }
};

export const getCurrentDungeonStage = (state: DungeonExplorationState): DungeonStage | null =>
  state.stages.find((stage) => stage.id === state.currentStage) ?? null;

export const isDungeonFleeAllowed = (state: DungeonExplorationState): boolean =>
  state.currentStage < DUNGEON_TOTAL_STAGES;

const buildRevealMessage = (event: DungeonEventType, goldAmount?: number): string => {
  switch (event) {
    case "nothing":
      return "La sala esta vacia. Solo ecos y polvo.";
    case "gold":
      return `Encontraste ${goldAmount ?? 0} monedas de oro.`;
    case "drop":
      return "Algo brilla en un rincon oscuro...";
    case "enemy":
      return "¡Un enemigo bloquea el paso!";
  }
};

export type RevealDungeonChoiceResult = {
  state: DungeonExplorationState;
  event: DungeonEventType;
  goldAmount?: number;
  choiceId: number;
};

export const revealDungeonChoice = (
  state: DungeonExplorationState,
  choiceId: number
): RevealDungeonChoiceResult | null => {
  if (state.status !== "active") {
    return null;
  }

  const stageIndex = state.stages.findIndex((stage) => stage.id === state.currentStage);
  if (stageIndex === -1) {
    return null;
  }

  const currentStage = state.stages[stageIndex];
  if (currentStage.explored) {
    return null;
  }

  const choiceIndex = currentStage.choices.findIndex((choice) => choice.id === choiceId);
  if (choiceIndex === -1) {
    return null;
  }

  const choice = currentStage.choices[choiceIndex];
  if (choice.revealed) {
    return null;
  }

  const event = choice.event;
  const goldAmount = choice.goldAmount;
  const nextStatus: DungeonExplorationStatus =
    event === "enemy" ? "enemy_found" : "stage_cleared";

  const updatedChoices = currentStage.choices.map((entry, index) =>
    index === choiceIndex ? { ...entry, revealed: true } : entry
  );

  const updatedStage: DungeonStage = {
    ...currentStage,
    explored: true,
    event,
    goldAmount,
    choices: updatedChoices
  };

  const nextStages = state.stages.map((stage, index) =>
    index === stageIndex ? updatedStage : stage
  );

  return {
    state: {
      ...state,
      stages: nextStages,
      status: nextStatus,
      log: [...state.log, `Etapa ${state.currentStage}: ${buildRevealMessage(event, goldAmount)}`].slice(
        -12
      )
    },
    event,
    goldAmount,
    choiceId
  };
};

export const patchDungeonStage = (
  state: DungeonExplorationState,
  stageId: number,
  patch: Partial<DungeonStage>
): DungeonExplorationState => ({
  ...state,
  stages: state.stages.map((stage) => (stage.id === stageId ? { ...stage, ...patch } : stage))
});

export const patchDungeonChoice = (
  state: DungeonExplorationState,
  stageId: number,
  choiceId: number,
  patch: Partial<DungeonChoice>
): DungeonExplorationState => ({
  ...state,
  stages: state.stages.map((stage) =>
    stage.id === stageId
      ? {
          ...stage,
          choices: stage.choices.map((choice) =>
            choice.id === choiceId ? { ...choice, ...patch } : choice
          )
        }
      : stage
  )
});

export const advanceDungeonStage = (
  state: DungeonExplorationState
): DungeonExplorationState | null => {
  if (state.status !== "stage_cleared") {
    return null;
  }

  if (state.currentStage >= state.totalStages) {
    return {
      ...state,
      status: "completed",
      log: [...state.log, "Completaste la mazmorra."].slice(-12)
    };
  }

  const clearedStages = state.stages.map((stage) =>
    stage.id === state.currentStage ? { ...stage, status: "cleared" as const } : stage
  );
  const nextStage = state.currentStage + 1;

  const nextStages = clearedStages.map((stage) =>
    stage.id === nextStage
      ? {
          ...stage,
          status: "current" as const,
          explored: false,
          choices: createStageChoices(stage.isFinal)
        }
      : stage
  );

  const nextState: DungeonExplorationState = {
    ...state,
    currentStage: nextStage,
    stages: nextStages,
    status: "active",
    log: [...state.log, `Avanzas a la etapa ${nextStage}.`].slice(-12)
  };

  if (nextStage === DUNGEON_TOTAL_STAGES) {
    return {
      ...nextState,
      log: [...nextState.log, "Llegaste a la sala final. Elige una opcion para enfrentar al jefe."].slice(
        -12
      )
    };
  }

  return nextState;
};

export const markDungeonStageClearedAfterVictory = (
  state: DungeonExplorationState
): DungeonExplorationState => {
  const stageIndex = state.stages.findIndex((stage) => stage.id === state.currentStage);
  if (stageIndex === -1) {
    return state;
  }

  const updatedStages = state.stages.map((stage, index) =>
    index === stageIndex ? { ...stage, status: "cleared" as const, explored: true } : stage
  );

  if (state.currentStage >= DUNGEON_TOTAL_STAGES) {
    return {
      ...state,
      stages: updatedStages,
      status: "completed",
      log: [...state.log, "Derrotaste al jefe final. La mazmorra es tuya."].slice(-12)
    };
  }

  return {
    ...state,
    stages: updatedStages,
    status: "stage_cleared",
    log: [...state.log, `Venciste al enemigo de la etapa ${state.currentStage}.`].slice(-12)
  };
};

export const markDungeonAbandoned = (state: DungeonExplorationState): DungeonExplorationState => ({
  ...state,
  status: "abandoned",
  log: [...state.log, "Escapaste de la mazmorra y abandonaste la expedicion."].slice(-12)
});

export const setDungeonEnemyFound = (
  state: DungeonExplorationState,
  enemyName: string,
  enemyImage: string
): DungeonExplorationState => {
  const stageIndex = state.stages.findIndex((stage) => stage.id === state.currentStage);
  if (stageIndex === -1) {
    return state;
  }

  const updatedStages = state.stages.map((stage, index) =>
    index === stageIndex
      ? {
          ...stage,
          enemyName,
          enemyImage,
          event: "enemy" as const,
          explored: true,
          choices: stage.choices.map((choice) =>
            choice.revealed
              ? { ...choice, enemyName, enemyImage }
              : choice
          )
        }
      : stage
  );

  return {
    ...state,
    stages: updatedStages,
    status: "enemy_found",
    log: [...state.log, `¡${enemyName} aparece en la etapa ${state.currentStage}!`].slice(-12)
  };
};
