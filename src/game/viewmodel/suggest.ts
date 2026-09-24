import { BOARD, neighbors, type Cell } from "../model/board.ts";
import { ackBrief, pendingBrief } from "../model/events.ts";
import {
  apFor,
  canDrain,
  canFusion,
  canIrrigate,
  canKibbutz,
  canPipe,
  cityWeightAt,
  claimOf,
  commitPolicy,
  fieldDemand,
  pipeCost,
  policyLines,
  queueAction,
  wetInfo,
  yearAp,
  type PolicyKind,
  type State,
} from "../model/sim.ts";

export type Hint = {
  kind: PolicyKind | "commit" | "wait";
  id: number | null;
  text: string;
};

/** One carrying slot, weighed against an 8 IL field. People are the score. Cash is the constraint. */
const PEOPLE = 25;
/** Tel Aviv. The political core was the coastal plain, not the ridge and not the northern fence. */
const CORE = { r: 22, c: 6 };

function dist(a: { r: number; c: number }, b: { r: number; c: number }): number {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
}

/** 1 on the coast at Tel Aviv. The northern riverbank is about a quarter. */
function politics(cell: { r: number; c: number }): number {
  return 1 / (1 + dist(cell, CORE) / 12);
}

function roomFor(board: State, budget: number, used: number, kind: PolicyKind, cell: Cell): boolean {
  return used + apFor(kind, cell) <= budget;
}

/** A long ditch is worth less than water you can pour today. Not so much less that the lake loses to one dune. */
function delay(steps: number): number {
  return 1 / (1 + steps * 0.35);
}

/** Cash and people from one field, paid when the water arrives. A city ring is extra people, and it does not care how far the hex is from Tel Aviv. */
function fieldWorth(cell: Cell): number {
  const demand = fieldDemand(cell) ?? 1;
  return ((8 * 20 + 4 * PEOPLE) / demand) * politics(cell) + cityWeightAt(cell) * PEOPLE;
}

function pour(cells: Cell[], spare: number, steps: number): number {
  const ranked = [...cells].sort((a, b) => fieldWorth(b) - fieldWorth(a));
  let flow = spare;
  let total = 0;
  for (const cell of ranked) {
    const demand = fieldDemand(cell) ?? 1;
    if (flow < demand) continue;
    flow -= demand;
    total += fieldWorth(cell);
  }
  return total * delay(steps);
}

/** Shortest legal ditch from a wet component to a hex. Returns the first segment. */
function walk(board: State, info: ReturnType<typeof wetInfo>, comp: number, goal: Cell): { first: number; steps: number } | null {
  const queue: { id: number; steps: number; first: number | null }[] = [];
  const seen = new Set<number>();
  for (const cell of BOARD) {
    if (info.compOf.get(cell.id) === comp) queue.push({ id: cell.id, steps: 0, first: null });
  }
  while (queue.length > 0) {
    queue.sort((a, b) => a.steps - b.steps);
    const cur = queue.shift()!;
    if (seen.has(cur.id)) continue;
    seen.add(cur.id);
    if (cur.steps > 0 && cur.id === goal.id && cur.first != null) return { first: cur.first, steps: cur.steps };
    const cell = BOARD[cur.id];
    for (const n of neighbors(cell.r, cell.c)) {
      if (seen.has(n.id)) continue;
      const legal = cur.steps === 0 ? canPipe(board, n, info) == null : pipeCost(board, n) != null && claimOf(board, n) !== "arab";
      if (!legal) continue;
      const cross = n.terrain === "fertile" ? 3 : 0;
      queue.push({ id: n.id, steps: cur.steps + apFor("pipe", n) + cross, first: cur.first ?? n.id });
    }
  }
  return null;
}

/** First pipe that touches another tank. The spring itself cannot be piped, so the goal is the network, not the hex. */
function walkTouch(board: State, info: ReturnType<typeof wetInfo>, fromComp: number, toComp: number): { first: number; steps: number } | null {
  const queue: { id: number; steps: number; first: number | null }[] = [];
  const seen = new Set<number>();
  for (const cell of BOARD) {
    if (info.compOf.get(cell.id) === fromComp) queue.push({ id: cell.id, steps: 0, first: null });
  }
  while (queue.length > 0) {
    queue.sort((a, b) => a.steps - b.steps);
    const cur = queue.shift()!;
    if (seen.has(cur.id)) continue;
    seen.add(cur.id);
    const cell = BOARD[cur.id];
    const touches = neighbors(cell.r, cell.c).some((n) => info.compOf.get(n.id) === toComp);
    if (cur.steps > 0 && cur.first != null && touches) return { first: cur.first, steps: cur.steps };
    for (const n of neighbors(cell.r, cell.c)) {
      if (seen.has(n.id) || info.compOf.get(n.id) === toComp) continue;
      const legal = cur.steps === 0 ? canPipe(board, n, info) == null : pipeCost(board, n) != null && claimOf(board, n) !== "arab";
      if (!legal) continue;
      const cross = n.terrain === "fertile" ? 3 : 0;
      queue.push({ id: n.id, steps: cur.steps + apFor("pipe", n) + cross, first: cur.first ?? n.id });
    }
  }
  return null;
}

function dryDesert(board: State, cell: Cell): boolean {
  return fieldDemand(cell) != null && board.terrain[cell.id] == null && !board.fields.some((f) => f.id === cell.id);
}

/** This tank already touches dirt it can pour on. Dig the lateral before another empty segment. */
function componentPours(board: State, info: ReturnType<typeof wetInfo>, comp: number): boolean {
  for (const cell of BOARD) {
    if (!dryDesert(board, cell)) continue;
    if (canIrrigate(board, cell, info) != null) continue;
    if (neighbors(cell.r, cell.c).some((n) => info.compOf.get(n.id) === comp)) return true;
  }
  return false;
}

/** First pipe toward desert that is still brown. Used once Beersheba's ring is green, and once a fusion tank has spare. */
function walkDirt(board: State, info: ReturnType<typeof wetInfo>, comp: number): { first: number; steps: number } | null {
  const queue: { id: number; steps: number; first: number | null }[] = [];
  const seen = new Set<number>();
  for (const cell of BOARD) {
    if (info.compOf.get(cell.id) === comp) queue.push({ id: cell.id, steps: 0, first: null });
  }
  while (queue.length > 0) {
    queue.sort((a, b) => a.steps - b.steps);
    const cur = queue.shift()!;
    if (seen.has(cur.id)) continue;
    seen.add(cur.id);
    const cell = BOARD[cur.id];
    if (cur.steps > 0 && cur.first != null && dryDesert(board, cell)) return { first: cur.first, steps: cur.steps };
    for (const n of neighbors(cell.r, cell.c)) {
      if (seen.has(n.id)) continue;
      const legal = cur.steps === 0 ? canPipe(board, n, info) == null : pipeCost(board, n) != null && claimOf(board, n) !== "arab";
      if (!legal) continue;
      const cross = n.terrain === "fertile" ? 3 : 0;
      queue.push({ id: n.id, steps: cur.steps + apFor("pipe", n) + cross, first: cur.first ?? n.id });
    }
  }
  return null;
}

type Choice = { kind: PolicyKind; id: number; value: number; text: string };

/** Next ditch. A tank already at Beersheba does not start a second road. An unjoined lake steps toward the southern line, not into a farm and stop. */
function bestPipe(board: State, info: ReturnType<typeof wetInfo>, budget: number, used: number): Choice | null {
  const beer = BOARD.find((c) => c.name === "Beersheba")!;
  const yarkon = BOARD.find((c) => c.source === "yarkon")!;
  const lake = BOARD.find((c) => c.source === "kinneret")!;
  const ring = hexRing(beer).filter((c) => fieldDemand(c) != null && board.terrain[c.id] == null && !board.fields.some((f) => f.id === c.id));
  if (ring.length === 0) {
    const dirt = BOARD.filter((c) => dryDesert(board, c));
    if (dirt.length === 0) return null;
    let best: Choice | null = null;
    const seen = new Set<number>();
    for (const cell of BOARD) {
      const comp = info.compOf.get(cell.id);
      if (comp == null || seen.has(comp)) continue;
      seen.add(comp);
      const spare = info.spare.get(comp) ?? 0;
      if (spare <= 0 || componentPours(board, info, comp)) continue;
      const route = walkDirt(board, info, comp);
      if (!route || !roomFor(board, budget, used, "pipe", BOARD[route.first])) continue;
      const value = pour(dirt, spare, route.steps);
      if (value <= 0) continue;
      if (!best || value > best.value) {
        best = {
          kind: "pipe",
          id: route.first,
          value,
          text: "Lay this pipe. Spare water is still in a tank, and dirt past Beersheba is still brown.",
        };
      }
    }
    return best;
  }
  const lakeComp = info.compOf.get(lake.id);
  const yComp = info.compOf.get(yarkon.id);
  let best: Choice | null = null;
  const consider = (choice: Choice) => {
    if (choice.value <= 0) return;
    if (!best || choice.value > best.value) best = choice;
  };
  const seen = new Set<number>();
  for (const origin of [yarkon, lake]) {
    const comp = info.compOf.get(origin.id);
    if (comp == null || seen.has(comp)) continue;
    seen.add(comp);
    if (info.compOf.get(beer.id) === comp) continue;
    const route = walk(board, info, comp, beer);
    if (!route || !roomFor(board, budget, used, "pipe", BOARD[route.first])) continue;
    const own = info.spare.get(comp) ?? 0;
    consider({
      kind: "pipe",
      id: route.first,
      value: pour(ring, own, route.steps),
      text:
        origin.source === "kinneret"
          ? "Lay this pipe. It carries the lake toward Beersheba. Farmland it crosses does not pay more. Dirt pays when it takes a flow."
          : "Lay this pipe. It is the next segment toward Beersheba. A pipe does not make a rain-fed farm pay more.",
    });
  }
  if (lakeComp != null && yComp != null && lakeComp !== yComp) {
    const join = walkTouch(board, info, lakeComp, yComp);
    if (join && roomFor(board, budget, used, "pipe", BOARD[join.first])) {
      const south = info.compOf.get(beer.id) === yComp ? { steps: 0 } : walk(board, info, yComp, beer);
      const steps = join.steps + (south?.steps ?? 12);
      consider({
        kind: "pipe",
        id: join.first,
        value: pour(ring, info.spare.get(lakeComp) ?? 0, steps),
        text: "Lay this pipe. It joins the lake to the southern ditch. The farmland in between does not pay more. The water pays when it reaches dirt.",
      });
    }
  }
  if (board.year >= 2005) {
    const dirt = BOARD.filter((c) => dryDesert(board, c));
    const seenComp = new Set<number>();
    for (const cell of BOARD) {
      const comp = info.compOf.get(cell.id);
      if (comp == null || seenComp.has(comp)) continue;
      seenComp.add(comp);
      const spare = info.spare.get(comp) ?? 0;
      if (spare <= 0 || componentPours(board, info, comp)) continue;
      const route = walkDirt(board, info, comp);
      if (!route || !roomFor(board, budget, used, "pipe", BOARD[route.first])) continue;
      consider({
        kind: "pipe",
        id: route.first,
        value: pour(dirt, Math.min(spare, 8), route.steps),
        text: "Lay this pipe. A tank on the coast still has water, and dirt is still brown.",
      });
    }
  }
  return best;
}

/** A dry year still has a shovel. Waiting is not a move while any legal work fits in the points. */
function spendPoint(board: State, info: ReturnType<typeof wetInfo>, budget: number, used: number): Choice | null {
  let best: Choice | null = null;
  const take = (choice: Choice) => {
    if (!best || choice.value > best.value) best = choice;
  };
  for (const cell of BOARD) {
    if (canIrrigate(board, cell, info) == null && roomFor(board, budget, used, "irrigate", cell)) {
      take({
        kind: "irrigate",
        id: cell.id,
        value: Math.max(1, fieldWorth(cell)),
        text: "Allocate this desert. The year still has action points.",
      });
    }
    if (canDrain(board, cell) == null && roomFor(board, budget, used, "drain", cell)) {
      take({
        kind: "drain",
        id: cell.id,
        value: PEOPLE + openedFlow(board),
        text: "Drain one Hula hex. The year still has action points, and the swamp is still holding the Jordan.",
      });
    }
  }
  return best;
}

/** One more unit of Jordan water. The ditch that carries it is a separate purchase, so this is not discounted twice. */
function openedFlow(board: State): number {
  const beer = BOARD.find((c) => c.name === "Beersheba")!;
  const ring = hexRing(beer).filter((c) => fieldDemand(c) != null && board.terrain[c.id] == null && !board.fields.some((f) => f.id === c.id));
  const sample = ring.find((c) => (fieldDemand(c) ?? 1) === 1) ?? ring[0];
  return sample ? fieldWorth(sample) : 4 * PEOPLE;
}

function hexRing(city: Cell): Cell[] {
  const seen = new Set<number>([city.id]);
  let edge = [city];
  for (let i = 0; i < 2; i++) {
    const next: Cell[] = [];
    for (const cur of edge) {
      for (const n of neighbors(cur.r, cur.c)) {
        if (seen.has(n.id)) continue;
        seen.add(n.id);
        next.push(n);
      }
    }
    edge = next;
  }
  seen.delete(city.id);
  return BOARD.filter((c) => seen.has(c.id));
}

/** Next shore tank. Spaced along the coast, aimed at dirt the plants already built do not cover. */
function fusionSite(board: State, dry: Cell[]): Cell | null {
  const plants = board.fusion.map((id) => BOARD[id]);
  let best: Cell | null = null;
  let bestScore = 0;
  let bestReach = -1;
  for (const cell of BOARD) {
    if (canFusion(board, cell) != null) continue;
    if (plants.some((p) => dist(p, cell) < 5)) continue;
    let score = 0;
    let reach = 0;
    for (const d of dry) {
      const nearest = plants.reduce((m, p) => Math.min(m, dist(p, d)), 80);
      const here = dist(cell, d);
      if (here + 3 < nearest) {
        score += 1;
        reach += Math.max(0, 24 - here);
      }
    }
    if (score > bestScore || (score === bestScore && reach > bestReach)) {
      bestScore = score;
      bestReach = reach;
      best = cell;
    }
  }
  return bestScore > 0 ? best : null;
}

/** One legal next move. Each option is scored in people and lira. The highest score wins. Nothing is aimed at a city by name unless that city pays more. */
export function suggestNext(state: State): Hint {
  if (state.over) return { kind: "wait", id: null, text: `${state.year}. The clock stopped. Sinai is back. The score is the people.` };
  if (pendingBrief(state)) return { kind: "wait", id: null, text: "Read the card. Continue, then ask again." };
  if (state.year < 1948) return { kind: "commit", id: null, text: "You own the swamp. They approved it in 1934 and did not dig it. Push for independence." };

  const draft = policyLines(state);
  const board = draft.projected;
  const budget = yearAp(state);
  if (draft.apUsed >= budget) return { kind: "commit", id: null, text: "Commit the policy. This year's action points are spent." };

  const info = wetInfo(board);
  const choices: Choice[] = [];

  const laterals = BOARD.filter((c) => canIrrigate(board, c, info) == null && roomFor(board, budget, draft.apUsed, "irrigate", c));
  if (laterals.length > 0) {
    laterals.sort((a, b) => fieldWorth(b) - fieldWorth(a));
    const best = laterals[0];
    const near = politics(best) >= 0.45;
    choices.push({
      kind: "irrigate",
      id: best.id,
      value: fieldWorth(best),
      text: near
        ? "Allocate this desert. It is closer to Tel Aviv than the northern riverbank, and the ring around a city holds more people than a dune."
        : "Allocate this desert. Nothing that grows a city pays more, and the tank can spare the flow.",
    });
  }

  const pipe = bestPipe(board, info, budget, draft.apUsed);
  if (pipe) choices.push(pipe);

  const swamp = BOARD.find((c) => canDrain(board, c) == null && roomFor(board, budget, draft.apUsed, "drain", c));
  if (swamp) {
    let hexes = 1;
    for (const n of neighbors(swamp.r, swamp.c)) {
      if (n.terrain === "desert" && board.terrain[n.id] == null && !board.fields.some((f) => f.id === n.id)) hexes += 1;
    }
    choices.push({
      kind: "drain",
      id: swamp.id,
      value: hexes * PEOPLE + openedFlow(board),
      text: "Drain one Hula hex. The swamp is holding the Jordan back. Opening it puts 1 more flow in the lake. The hex becomes rain-fed, not a tank.",
    });
  }

  let well: { id: number; value: number } | null = null;
  for (const cell of BOARD) {
    if (cell.terrain !== "desert" && cell.terrain !== "hard") continue;
    if (canKibbutz(board, cell) != null || !roomFor(board, budget, draft.apUsed, "kibbutz", cell)) continue;
    const piped = neighbors(cell.r, cell.c).some((n) => board.pipes.includes(n.id) && info.wet.has(n.id));
    if (!piped) continue;
    const dirt = neighbors(cell.r, cell.c).filter((n) => (n.terrain === "desert" || n.terrain === "hard") && board.terrain[n.id] == null && !board.fields.some((f) => f.id === n.id));
    const value = PEOPLE * 2 + Math.max(0, ...dirt.map((n) => cityWeightAt(n) * PEOPLE));
    if (!well || value > well.value) well = { id: cell.id, value };
  }
  if (well) {
    choices.push({
      kind: "kibbutz",
      id: well.id,
      value: well.value,
      text: "Found a kibbutz on this dirt, beside the ditch. The well adds 1 flow to the pipe. It is not a farm on a farm.",
    });
  }

  if (state.year >= 2050 && board.fusion.length < 6) {
    const dirt = BOARD.filter((c) => dryDesert(board, c));
    const spare = [...info.spare.values()].reduce((sum, n) => sum + n, 0);
    if (dirt.length > 40 && spare < 12 && dirt.length > spare + 30) {
      const site = fusionSite(board, dirt);
      if (site && roomFor(board, budget, draft.apUsed, "fusion", site)) {
        choices.push({
          kind: "fusion",
          id: site.id,
          value: spare < 4 ? 8 * PEOPLE : 3 * PEOPLE,
          text: "Build a fusion plant against the sea. Tank of 50. It does not green the dirt. The ditch does that.",
        });
      }
    }
  }

  choices.sort((a, b) => b.value - a.value);
  const top = choices[0];
  if (top) return { kind: top.kind, id: top.id, text: top.text };
  const leftover = spendPoint(board, info, budget, draft.apUsed);
  if (leftover) return leftover;
  return { kind: "commit", id: null, text: "Commit the year. No legal work is left. The points cannot be spent." };
}

/** Do the hinted move. A card is dismissed. A stopped clock returns null. */
export function playHint(state: State): State | null {
  if (state.over) return null;
  const hint = suggestNext(state);
  if (hint.kind === "wait") {
    const brief = pendingBrief(state);
    return brief ? ackBrief(state, brief.id) : null;
  }
  if (hint.kind === "commit") return commitPolicy(state);
  if (hint.id == null) return null;
  const next = queueAction(state, hint.kind, hint.id);
  if (next.policy.length === state.policy.length) return null;
  return next;
}
