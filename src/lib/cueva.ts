export type CaveEventType = "nothing" | "enemy" | "gold" | "drop";

export type CaveDropResolvedAs = "item" | "gold" | "nothing";

export type CaveCell = {
  id: number;
  event: CaveEventType;
  revealed: boolean;
  goldAmount?: number;
  dropItemImage?: string;
  dropItemName?: string;
  dropResolvedAs?: CaveDropResolvedAs;
  enemyImage?: string;
  enemyName?: string;
};

export type CaveExplorationStatus = "active" | "enemy_found" | "completed";

export type CaveExplorationState = {
  gridSize: number;
  maxClicks: number;
  clicksUsed: number;
  cells: CaveCell[];
  status: CaveExplorationStatus;
  log: string[];
};

export const CAVE_GRID_SIZE = 4;
export const CAVE_MAX_CLICKS = 5;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const randomBetween = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const rollCaveEvent = (): CaveEventType => {
  const roll = Math.random() * 100;
  if (roll < 25) {
    return "nothing";
  }
  if (roll < 55) {
    return "gold";
  }
  if (roll < 72) {
    return "drop";
  }
  return "enemy";
};

export const createCaveExplorationState = (
  gridSize = CAVE_GRID_SIZE,
  maxClicks = CAVE_MAX_CLICKS
): CaveExplorationState => {
  const totalCells = gridSize * gridSize;
  const cells: CaveCell[] = Array.from({ length: totalCells }, (_, index) => {
    const event = rollCaveEvent();
    return {
      id: index,
      event,
      revealed: false,
      goldAmount: event === "gold" ? randomBetween(15, 55) : undefined
    };
  });

  return {
    gridSize,
    maxClicks,
    clicksUsed: 0,
    cells,
    status: "active",
    log: ["Entraste a la cueva. Explora hasta 5 casillas."]
  };
};

export const normalizeCaveExplorationState = (raw: unknown): CaveExplorationState | null => {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const source = raw as Partial<CaveExplorationState>;
  const gridSize =
    typeof source.gridSize === "number" && Number.isFinite(source.gridSize)
      ? clamp(Math.round(source.gridSize), 3, 6)
      : CAVE_GRID_SIZE;
  const maxClicks =
    typeof source.maxClicks === "number" && Number.isFinite(source.maxClicks)
      ? clamp(Math.round(source.maxClicks), 1, 10)
      : CAVE_MAX_CLICKS;
  const clicksUsed =
    typeof source.clicksUsed === "number" && Number.isFinite(source.clicksUsed)
      ? clamp(Math.round(source.clicksUsed), 0, maxClicks)
      : 0;

  const status =
    source.status === "active" || source.status === "enemy_found" || source.status === "completed"
      ? source.status
      : "active";

  const rawCells = Array.isArray(source.cells) ? source.cells : [];
  const expectedCells = gridSize * gridSize;
  const cells: CaveCell[] = [];

  for (let index = 0; index < expectedCells; index += 1) {
    const cellRaw = rawCells[index];
    if (!cellRaw || typeof cellRaw !== "object") {
      return null;
    }

    const cell = cellRaw as Partial<CaveCell>;
    const event =
      cell.event === "nothing" ||
      cell.event === "enemy" ||
      cell.event === "gold" ||
      cell.event === "drop"
        ? cell.event
        : "nothing";

    cells.push({
      id: index,
      event,
      revealed: cell.revealed === true,
      goldAmount:
        typeof cell.goldAmount === "number" && Number.isFinite(cell.goldAmount)
          ? Math.max(0, Math.round(cell.goldAmount))
          : event === "gold"
            ? randomBetween(15, 55)
            : undefined,
      dropItemImage:
        typeof cell.dropItemImage === "string" && cell.dropItemImage.trim().length > 0
          ? cell.dropItemImage.trim()
          : undefined,
      dropItemName:
        typeof cell.dropItemName === "string" && cell.dropItemName.trim().length > 0
          ? cell.dropItemName.trim()
          : undefined,
      dropResolvedAs:
        cell.dropResolvedAs === "item" ||
        cell.dropResolvedAs === "gold" ||
        cell.dropResolvedAs === "nothing"
          ? cell.dropResolvedAs
          : undefined,
      enemyImage:
        typeof cell.enemyImage === "string" && cell.enemyImage.trim().length > 0
          ? cell.enemyImage.trim()
          : undefined,
      enemyName:
        typeof cell.enemyName === "string" && cell.enemyName.trim().length > 0
          ? cell.enemyName.trim()
          : undefined
    });
  }

  const log = Array.isArray(source.log)
    ? source.log.filter((line): line is string => typeof line === "string").slice(-12)
    : ["Entraste a la cueva. Explora hasta 5 casillas."];

  return {
    gridSize,
    maxClicks,
    clicksUsed,
    cells,
    status,
    log
  };
};

export const getCaveEventLabel = (event: CaveEventType): string => {
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

export const revealCaveCell = (
  state: CaveExplorationState,
  cellId: number
): CaveExplorationState | null => {
  if (state.status !== "active") {
    return null;
  }

  if (state.clicksUsed >= state.maxClicks) {
    return null;
  }

  const cellIndex = state.cells.findIndex((cell) => cell.id === cellId);
  if (cellIndex === -1) {
    return null;
  }

  const cell = state.cells[cellIndex];
  if (cell.revealed) {
    return null;
  }

  const nextClicksUsed = state.clicksUsed + 1;
  const updatedCells = state.cells.map((entry, index) =>
    index === cellIndex ? { ...entry, revealed: true } : entry
  );

  let nextStatus: CaveExplorationStatus = state.status;
  if (cell.event === "enemy") {
    nextStatus = "enemy_found";
  } else if (nextClicksUsed >= state.maxClicks) {
    nextStatus = "completed";
  }

  const eventMessage = buildRevealMessage(cell);
  const nextLog = [...state.log, eventMessage];
  if (nextStatus === "completed") {
    nextLog.push("Exploraste la cueva. No quedan casillas por revisar.");
  }

  return {
    ...state,
    clicksUsed: nextClicksUsed,
    cells: updatedCells,
    status: nextStatus,
    log: nextLog.slice(-12)
  };
};

const buildRevealMessage = (cell: CaveCell): string => {
  switch (cell.event) {
    case "nothing":
      return "Casilla vacia. Solo polvo y silencio.";
    case "gold":
      return `Encontraste ${cell.goldAmount ?? 0} monedas de oro.`;
    case "drop":
      return "Algo brilla entre las rocas...";
    case "enemy":
      return "¡Un enemigo salta desde la oscuridad!";
  }
};

export const isCaveExplorationActive = (state: CaveExplorationState | null | undefined): boolean =>
  state?.status === "active";

export const getCaveClicksRemaining = (state: CaveExplorationState): number =>
  Math.max(0, state.maxClicks - state.clicksUsed);
