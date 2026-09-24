import { BOARD, neighbors, type Cell, type Terrain } from "../model/board.ts";
import { pendingBrief, type Brief } from "../model/events.ts";
import { paperFor, type Paper } from "../model/papers.ts";
import { suggestNext, type Hint } from "./suggest.ts";
import {
  canDrain,
  canIrrigate,
  canKibbutz,
  canPipe,
  canUpgrade,
  canFusion,
  cityHold,
  claimOf,
  coach,
  DRAIN_CASH,
  FUSION_CASH,
  FUSION_FLOW,
  il,
  IRRIGATE_CASH,
  kibbutzCost,
  pipeCost,
  policyLines,
  scoreLine,
  terrainOf,
  TOWN_CASH,
  wetInfo,
  apFor,
  yearAp,
  type State,
} from "../model/sim.ts";

/** Fills live here so the view does not invent a second palette. */
export const FILL: Record<Terrain, string> = {
  sea: "#1a4f6e",
  lake: "#2a7ea8",
  source: "#2a7ea8",
  urban: "#a15c38",
  orchard: "#3d5c28",
  river: "#2f86c8",
  fertile: "#4f8f2a",
  swamp: "#3a4618",
  desert: "#e08a2a",
  hard: "#efe2c4",
  mountain: "#6e584c",
  salt: "#8aa4b8",
  rift: "#c4a574",
  gaza: "#8d8d88",
  beyond: "#e4d8c4",
};

export const ALLOCATED = "#3c9a36";
export const PLANNED = "#b7d98a";

export type PresentedCell = {
  id: number;
  r: number;
  c: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeOpacity: number;
  piped: boolean;
  wet: boolean;
  flow: number;
  name?: string;
  legal: boolean;
  planned: boolean;
  kibbutz: boolean;
  /** A kibbutz that grew into a town. Drawn brown, same as a city. */
  town: boolean;
  fusion: boolean;
  opacity: number;
  /** Bought land is blue. Highland and the reserved swamp are green. */
  deed: "yishuv" | "arab" | "open";
  tex: string | null;
  /** Short name for the hover card. */
  title: string;
  facts: { k: string; v: string }[];
};

export type PresentedAction = {
  id: "pipe" | "irrigate" | "drain" | "kibbutz" | "upgrade" | "fusion";
  label: string;
  /** What this button does to the hex you are looking at. Not the recommended hex. */
  effect: string;
  disabled: boolean;
  reason: string | null;
};

export type Presented = {
  year: number;
  cash: number;
  pop: number;
  granary: number;
  spare: number;
  score: string;
  coach: string;
  over: boolean;
  log: string[];
  cells: PresentedCell[];
  title: string;
  blurb: string;
  actions: PresentedAction[];
  policy: { index: number; label: string; ok: boolean; reason: string | null; cash: number; ap: number; runningCash: number; runningAp: number }[];
  apUsed: number;
  apTotal: number;
  policyCash: number;
  brief: Brief | null;
  hint: Hint;
  /** The suggested action on the hex you are looking at, or commit when that is the only move. */
  best: PresentedAction["id"] | "commit" | null;
  /** Set before 1948. The paper is the only move. */
  paper: Paper | null;
};

export function present(state: State, selectedId: number | null): Presented {
  const draft = policyLines(state);
  const board = draft.projected;
  const info = wetInfo(board);
  const spare = [...info.spare.values()].reduce((sum, n) => sum + n, 0);
  const selected = selectedId == null ? null : BOARD[selectedId] ?? null;
  const plannedPipes = new Set(board.pipes.filter((id) => !state.pipes.includes(id)));
  const plannedFields = new Set(board.fields.map((f) => f.id).filter((id) => !state.fields.some((f) => f.id === id)));

  const budget = yearAp(state);
  const cells: PresentedCell[] = BOARD.map((h) => {
    const t = terrainOf(board, h);
    const field = board.fields.some((f) => f.id === h.id);
    const legal = canPipe(board, h, info) == null && draft.apUsed + apFor("pipe", h) <= budget;
    const kibbutz = board.kibbutzim.includes(h.id);
    const town = board.foundedTowns.includes(h.id);
    const fusion = board.fusion.includes(h.id);
    const on = selectedId === h.id;
    const green = kibbutz && t !== "urban";
    return {
      id: h.id,
      r: h.r,
      c: h.c,
      fill:
        fusion
          ? FILL.lake
          : field && !plannedFields.has(h.id)
            ? "url(#tex-fertile)"
            : field
              ? PLANNED
              : green || t === "fertile"
                ? "url(#tex-fertile)"
                : FILL[t],
      stroke: on ? "#1c1914" : legal ? "#a15c38" : "#2a241c",
      strokeWidth: on ? 1.8 : legal ? 1.3 : 0.35,
      strokeOpacity: on || legal ? 1 : 0.35,
      piped: board.pipes.includes(h.id),
      wet: info.wet.has(h.id),
      flow: h.flow,
      name: h.name,
      legal,
      planned: plannedPipes.has(h.id),
      kibbutz,
      town,
      fusion,
      opacity: 1,
      deed: claimOf(board, h),
      tex: fusion || field || green || t === "fertile" ? null : textureFor(t),
      title: h.name ?? landLabel(board, h),
      facts: hoverFacts(board, h, info, plannedPipes.has(h.id), plannedFields.has(h.id)),
    };
  });

  const hint = suggestNext(state);
  const best = hint.kind === "wait" ? null : hint.kind === "commit" ? "commit" : hint.id === selectedId ? hint.kind : null;

  return {
    year: state.year,
    cash: state.cash,
    pop: state.pop,
    granary: state.granary,
    spare,
    score: scoreLine(board),
    coach: coach(state.year),
    over: state.over,
    log: state.log.slice(0, 2),
    cells,
    title: selected ? selected.name ?? landLabel(board, selected) : "Pick a hex. Copper outline is a legal next segment.",
    blurb: selected ? blurb(board, selected, info.wet.has(selected.id)) : "",
    actions: selected ? actionsFor(state, board, draft.apUsed, selected) : [],
    policy: draft.lines.map((line) => ({
      index: line.index,
      label: line.label,
      ok: line.ok,
      reason: line.reason,
      cash: line.cash,
      ap: line.ap,
      runningCash: line.runningCash,
      runningAp: line.runningAp,
    })),
    apUsed: draft.apUsed,
    apTotal: budget,
    policyCash: draft.cashUsed,
    brief: pendingBrief(state),
    hint,
    best,
    paper: state.year < 1948 ? paperFor(state.year) : null,
  };
}

const LAND_NAME: Record<Terrain, string> = {
  sea: "Sea",
  lake: "Lake",
  source: "Spring",
  river: "Jordan",
  rift: "Arava",
  gaza: "Gaza",
  swamp: "Swamp",
  desert: "Soft desert",
  hard: "Hard desert",
  mountain: "Ridge",
  urban: "Town",
  fertile: "Already farmed",
  orchard: "Olive orchard",
  salt: "Dead Sea",
  beyond: "Beyond the Jordan",
};

/** Hover name. A watered hex is a farm, not the desert it used to be. */
export function landLabel(board: State, h: Cell): string {
  if (board.fusion.includes(h.id)) return "Fusion plant";
  if (board.kibbutzim.includes(h.id)) return "Kibbutz";
  if (board.fields.some((f) => f.id === h.id)) return "Farmed";
  return LAND_NAME[terrainOf(board, h)];
}

const HELD_NAME = { yishuv: "Bought", arab: "Not yours", open: "Open" } as const;

function hoverFacts(
  board: State,
  h: Cell,
  info: ReturnType<typeof wetInfo>,
  plannedPipe: boolean,
  plannedField: boolean,
): { k: string; v: string }[] {
  const field = board.fields.find((f) => f.id === h.id);
  const facts: { k: string; v: string }[] = [
    { k: "Land", v: landLabel(board, h) },
    { k: "Held", v: HELD_NAME[claimOf(board, h)] },
  ];
  const city = cityHold(board).find((c) => c.name === h.name);
  if (city) facts.push({ k: "City", v: `Can hold ${city.hold}. Farmland within two hexes raises it` });
  if (h.source === "kinneret") {
    const open = info.cap.get(info.compOf.get(h.id)!) ?? h.flow;
    facts.push({ k: "Tank", v: open < h.flow ? `${open} of ${h.flow}. The swamp holds the rest` : String(open) });
  } else if (h.flow > 0) facts.push({ k: "Tank", v: String(h.flow) });
  if (board.pipes.includes(h.id)) facts.push({ k: "Ditch", v: plannedPipe ? "Planned" : info.wet.has(h.id) ? "Wet" : "Cut" });
  if (field) {
    facts.push({
      k: "Water",
      v: field.well != null ? "Well, drinks 1" : plannedField ? `Planned, drinks ${field.demand}` : `Allocated, drinks ${field.demand}`,
    });
  }
  if (board.fusion.includes(h.id)) facts.push({ k: "Plant", v: `Fusion desalination. Tank of ${FUSION_FLOW}` });
  if (board.kibbutzim.includes(h.id)) facts.push({ k: "Place", v: "Kibbutz. A farm. Beside a ditch the well adds 1 flow to the pipe" });
  if (board.foundedTowns.includes(h.id)) facts.push({ k: "Place", v: "Town. Holds 6 more people than the well did" });
  if (board.gardens.includes(h.id)) facts.push({ k: "Garden", v: "Green. Does not drink the tank" });
  if (board.served.includes(h.id)) facts.push({ k: "Carrier", v: "Town is on the ditch" });
  if (board.drained.includes(h.id)) facts.push({ k: "Work", v: "Drained" });
  return facts;
}

function textureFor(t: Terrain): string {
  const name = t === "source" || t === "river" ? "lake" : t === "orchard" ? "fertile" : t === "rift" || t === "gaza" ? "beyond" : t;
  return `url(#tex-${name})`;
}
function actionsFor(base: State, board: State, apUsed: number, cell: Cell): PresentedAction[] {
  const info = wetInfo(board);
  const out: PresentedAction[] = [];
  const queued = (kind: PresentedAction["id"]) => base.policy.some((item) => item.kind === kind && item.id === cell.id);
  const cost = pipeCost(board, cell);
  if (cost != null) {
    const ap = apFor("pipe", cell);
    let reason = canPipe(board, cell, info);
    if (!reason && queued("pipe")) reason = "Already on this year's policy.";
    if (!reason && apUsed + ap > yearAp(base)) reason = "No action points left.";
    out.push({
      id: "pipe",
      label: `Add pipe (${il(cost)}, ${ap} AP)`,
      effect: "Extends the ditch onto this hex. It does not make a rain-fed farm pay more. Dirt pays when a desert on the ditch takes a flow.",
      disabled: reason != null,
      reason,
    });
  }
  if ((cell.terrain === "desert" || cell.terrain === "hard" || cell.terrain === "gaza") && !board.terrain[cell.id] && !board.kibbutzim.includes(cell.id)) {
    const ap = apFor("irrigate", cell);
    let reason = canIrrigate(board, cell, info);
    if (!reason && queued("irrigate")) reason = "Already on this year's policy.";
    if (!reason && apUsed + ap > yearAp(base)) reason = "No action points left.";
    const demand = cell.terrain === "hard" ? 2 : 1;
    const food = cell.terrain === "hard" ? "1 food" : "2 food";
    out.push({
      id: "irrigate",
      label: `Add allocation (${demand} flow, ${il(IRRIGATE_CASH)}, ${ap} AP)`,
      effect: `Greens this hex. Drinks ${demand}. On the carrier it holds 4 people, pays 8 IL, and makes ${food}. On a well it holds 1 person, pays 3 IL, and makes 1 food.`,
      disabled: reason != null,
      reason,
    });
  }
  if (terrainOf(board, cell) === "swamp") {
    const ap = apFor("drain", cell);
    let reason = canDrain(board, cell);
    if (!reason && queued("drain")) reason = "Already on this year's policy.";
    if (!reason && apUsed + ap > yearAp(base)) reason = "No action points left.";
    out.push({
      id: "drain",
      label: `Add drain (${il(DRAIN_CASH)}, ${ap} AP)`,
      effect: "Opens 1 more flow into the Kinneret. This hex becomes rain-fed and holds 1 person. It is not a tank.",
      disabled: reason != null,
      reason,
    });
  }
  const ground = terrainOf(board, cell);
  const canSettle = (ground === "desert" || ground === "hard") && !board.pipes.includes(cell.id);
  if (canSettle && !board.kibbutzim.includes(cell.id)) {
    const ap = apFor("kibbutz", cell);
    const settleCost = kibbutzCost(cell);
    let reason = canKibbutz(board, cell);
    if (!reason && queued("kibbutz")) reason = "Already on this year's policy.";
    if (!reason && apUsed + ap > yearAp(base)) reason = "No action points left.";
    out.push({
      id: "kibbutz",
      label: cell.source ? `Found on the spring (${il(settleCost)}, ${ap} AP)` : `Found kibbutz (${il(settleCost)}, ${ap} AP)`,
      effect: "A farm on dirt. If a ditch is next door, the well adds 1 flow to that pipe. Five prosperous years, with farms around it, make a town.",
      disabled: reason != null,
      reason,
    });
  }
  if (board.kibbutzim.includes(cell.id)) {
    const ap = apFor("upgrade", cell);
    let reason = canUpgrade(board, cell);
    if (!reason && queued("upgrade")) reason = "Already on this year's policy.";
    if (!reason && apUsed + ap > yearAp(base)) reason = "No action points left.";
    out.push({
      id: "upgrade",
      label: `Make it a town (${il(TOWN_CASH)}, ${ap} AP)`,
      effect: "The kibbutz has gotten rich enough to be a town. Holds 6 more people than the well. It does not have to sit next to another city. A bare ditch is not a town.",
      disabled: reason != null,
      reason,
    });
  }
  if (neighbors(cell.r, cell.c).some((n) => n.terrain === "sea") && (ground === "desert" || ground === "hard" || ground === "fertile")) {
    const ap = apFor("fusion", cell);
    let reason = canFusion(board, cell);
    if (!reason && queued("fusion")) reason = "Already on this year's policy.";
    if (!reason && apUsed + ap > yearAp(base)) reason = "No action points left.";
    out.push({
      id: "fusion",
      label: `Fusion plant (${il(FUSION_CASH)}, ${ap} AP)`,
      effect: `A tank of ${FUSION_FLOW} on this shore, from 2050. It does not green the dirt. A ditch has to carry it.`,
      disabled: reason != null,
      reason,
    });
  }
  return out;
}

function blurb(state: State, cell: Cell, wet: boolean): string {
  const t = terrainOf(state, cell);
  const pipe = state.pipes.includes(cell.id);
  const field = state.fields.some((f) => f.id === cell.id);
  const neighborWet = neighbors(cell.r, cell.c).filter((n) => wetInfo(state).wet.has(n.id)).length;
  let line = "";
  if (field) line = "Farmed. The photo is the crop. It eats flow from the tank it touches, and it is no longer desert.";
  else if (pipe) line = wet ? "Pipe hex. The ditch can step onto any outlined neighbor." : "Pipe hex, dry. The link back to a tank is broken.";
  else if (t === "source" || t === "lake") line = "Fresh water. Pipe the land hexes on the shore. You cannot build on the lake itself.";
  else if (cell.name === "Jerusalem")
    line = "Jerusalem. Highland town. The neighbors are ridge, and there is no tank. A pipe here does not open the south. The carrier goes west, then south.";
  else if (cell.name === "Beersheba")
    line = "Beersheba. A Bedouin market before 1948. The people who stayed became citizens. The city grows when the pipe from the Yarkon arrives, not when a well waters one dune.";
  else if (cell.name === "Tel Aviv" || cell.name === "Haifa")
    line = `${cell.name}. Already a city because the land around it was already a garden. More farmland within two hexes lets it hold more people.`;
  else if (t === "urban") line = "Town. A pipe here spends the tank on the desert beside it, up to three hexes. You do not found a kibbutz on a town.";
  else if (t === "orchard") line = "Olive orchard. Palestinian groves were already on these slopes. Not your land, and not desert. A ditch does not create them.";
  else if (t === "river")
    line =
      cell.reach === "lower"
        ? "The Jordan. This is the eastern border. East of the river is Transjordan, not this board. It runs to the Dead Sea and is not the tap. The pump is at the Kinneret, and the water goes west."
        : "The Jordan above the lake. Same water as the Kinneret. From the lake south, the river is the border.";
  else if (t === "fertile") line = "Already rain-fed. Most of the country is not. A ditch can cross it.";
  else if (t === "swamp") line = "Hula. The Jordan is backed up here. Drain it and 1 more flow reaches the lake. This hex becomes rain-fed. It is not a tank.";
  else if (t === "desert") line = "Soft desert. This is the starting condition. One spare flow turns it green.";
  else if (t === "hard") line = "Hard desert, pale. Two flow.";
  else if (t === "mountain") line = "Ridge. A tunnel costs more. The pass is the gap in the ridge.";
  else if (t === "sea") line = "Sea. Not a tank.";
  else if (t === "salt") line = "Dead Sea. The border runs through it. Salt. Not a farm and not a source.";
  else if (t === "rift") line = "The Arava. South of the Dead Sea the border keeps going, dry, to the gulf. Not a tank.";
  else if (t === "gaza")
    line =
      state.year >= 2005
        ? "Gaza. Left in 2005. The hex stays gray. What you built here is gone."
        : state.year >= 1967
          ? "Gaza. You can build on it until 2005. Then you leave it."
          : "Gaza. Egypt holds it after 1948. Two gray hexes. Not yours yet.";
  else if (cell.name === "Lebanon" || cell.name === "Syria" || cell.name === "Jordan" || cell.name === "Egypt")
    line = `${cell.name}. Across the border. No ditch.`;
  else if (cell.name === "Ashkelon")
    line =
      state.year >= 2005
        ? `Ashkelon. Desalination on the coast. Flow ${state.year >= 2013 ? 24 : state.year >= 2010 ? 16 : 8}. For the cities, not a second Negev.`
        : "Ashkelon. A coastal town. The sea is not a tank until 2005.";
  else if (t === "beyond") line = "East of the Jordan, or off the map. Not this board.";
  if (cell.flow) line += ` Tank ${cell.flow}.`;
  if (neighborWet) line += ` Wet neighbors: ${neighborWet}.`;
  return line;
}
