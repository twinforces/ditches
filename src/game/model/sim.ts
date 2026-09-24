import { BOARD, neighbors, type Cell, type Terrain } from "./board.ts";
import { paperFor } from "./papers.ts";

export type Pipe = { id: number };
export type Field = { id: number; demand: number; order: number; well?: number };

/** One line of this year's water policy. Cash and AP are priced again at commit. */
export type PolicyKind = "pipe" | "irrigate" | "drain" | "kibbutz" | "upgrade" | "fusion";
export type PolicyItem = { kind: PolicyKind; id: number };

/**
 * Hula was dug 1951-1957 (JNF, then the Chicago dredges; the last barrier went on 30 Oct 1957).
 * This board has 12 swamp hexes. At 1 AP each and 2 AP a year, spending the decade on the swamp
 * takes 6 years, which is the project, not a weekend.
 */
export const YEAR_AP = 2;
export const AP_CAP = 6;

/** Built carrier land buys time. A well does not. Four watered or drained hexes are one more action next year, up to 6. */
export function yearAp(s: State): number {
  const national = s.fields.filter((f) => f.well == null).length;
  return Math.min(AP_CAP, YEAR_AP + Math.floor((national + s.drained.length) / 4));
}
export const DRAIN_CASH = 18;
export const IRRIGATE_CASH = 14;
/** A drilled well. Coastal and northwestern-Negev wells were real. Deep Negev wells were small and often salty. */
export const KIBBUTZ_CASH = 36;
/** Sitting on a spring (an Ein) was cheaper than drilling. The spring was already there. */
export const SPRING_KIBBUTZ_CASH = 20;
/** A kibbutz on the carrier can become a town. The well does not make it one. */
export const TOWN_CASH = 48;

/** Palestine pound, then from 1952 the Israeli lira. Same unit. The shekel is 1980. */
export function il(n: number): string {
  return `${n} IL`;
}

export type State = {
  year: number;
  cash: number;
  pop: number;
  granary: number;
  pipes: number[];
  /** desert/hard hexes allocated water */
  fields: Field[];
  drained: number[];
  /** terrain overrides after drain */
  terrain: Record<number, Terrain>;
  log: string[];
  order: number;
  over: boolean;
  /** Draft for this year. Nothing here is built until commit. */
  policy: PolicyItem[];
  /** Settlements. A kibbutz on ordinary land is a well of flow 1, range one hex. It does not join the carrier. */
  kibbutzim: number[];
  /** Interstitials already dismissed. */
  seen: string[];
  /** After 1967 the ridge can be dug. It does not become farmland. */
  highlandOpen: boolean;
  /** Dirt that greened because the carrier reached a kibbutz. It does not drink the tank. */
  gardens: number[];
  /** Kibbutzim that have already received that zone. */
  linked: number[];
  /** Towns the carrier has already reached. They conduct, and they took their desert allocation. */
  served: number[];
  /** Kibbutzim that were upgraded. They hold more people than a well. */
  foundedTowns: number[];
  /** Year each kibbutz was founded. A green ring for five years makes a town. */
  kibbutzYear: Record<number, number>;
  /** Gaza works were pulled in 2005. Once. */
  gazaLeft: boolean;
  /** Year the water you had was all on dirt. Null if the tanks never covered it. */
  promisedYear: number | null;
  /** Fusion desalination plants on the shore. Each is a tank of 50, from 2050. */
  fusion: number[];
  /** Dunes bought and put under the plow during the Mandate. Not a ditch. */
  bought: number[];
};

const PIPE_COST: Partial<Record<Terrain, number>> = {
  mountain: 48,
  hard: 30,
  desert: 20,
  gaza: 20,
  fertile: 16,
  urban: 16,
};

export function terrainOf(s: State, cell: Cell): Terrain {
  if (s.terrain[cell.id]) return s.terrain[cell.id];
  if (s.year < 1921 && jezeelDeed(cell)) return "desert";
  return cell.terrain;
}

/** The Sursock valley. On the board it is already farmland. Before 1921 it has not been sold. */
function jezeelDeed(cell: Cell): boolean {
  return cell.terrain === "fertile" && cell.claim === "yishuv" && cell.r >= 17 && cell.r <= 19 && cell.c >= 7 && cell.c <= 11;
}

function conducts(s: State, cell: Cell): boolean {
  const t = terrainOf(s, cell);
  if (t === "source" || t === "lake") return true;
  if (t === "river" && cell.reach === "upper") return true;
  if (cell.name === "Ashkelon" && desalFlow(s.year) > 0) return true;
  if (s.served.includes(cell.id)) return true;
  if (s.fusion.includes(cell.id)) return true;
  return s.pipes.includes(cell.id);
}

/** Swamp still sitting on the Jordan. The basalt plug held that water out of the lake until the hex was opened. */
export function hulaHeld(s: State): number {
  return BOARD.filter((c) => c.terrain === "swamp" && c.claim === "yishuv" && !s.drained.includes(c.id)).length;
}

export type WetInfo = {
  wet: Set<number>;
  compOf: Map<number, number>;
  spare: Map<number, number>;
  cap: Map<number, number>;
};

/** Flood pipes + lakes + sources. Capacity is source flow inside the component. */
export function wetInfo(s: State): WetInfo {
  const wet = new Set<number>();
  const compOf = new Map<number, number>();
  const cap = new Map<number, number>();
  let comp = 0;
  for (const cell of BOARD) {
    if (!conducts(s, cell) || compOf.has(cell.id)) continue;
    const id = comp++;
    let flow = 0;
    const stack = [cell];
    compOf.set(cell.id, id);
    wet.add(cell.id);
    while (stack.length) {
      const cur = stack.pop()!;
      if (cur.name === "Ashkelon") flow += desalFlow(s.year);
      if (s.fusion.includes(cur.id)) flow += FUSION_FLOW;
      if (cur.flow) flow += cur.flow;
      if (cur.source === "kinneret") flow -= hulaHeld(s);
      for (const n of neighbors(cur.r, cur.c)) {
        if (!conducts(s, n) || compOf.has(n.id)) continue;
        compOf.set(n.id, id);
        wet.add(n.id);
        stack.push(n);
      }
    }
    cap.set(id, flow);
  }
  for (const kid of s.kibbutzim) {
    const home = BOARD[kid];
    if (home.terrain !== "desert" && home.terrain !== "hard") continue;
    const touch = neighbors(home.r, home.c).find((n) => wet.has(n.id) && s.pipes.includes(n.id));
    if (!touch) continue;
    const cid = compOf.get(touch.id);
    if (cid == null) continue;
    cap.set(cid, (cap.get(cid) ?? 0) + 1);
  }
  const used = new Map<number, number>();
  for (const f of s.fields) {
    if (f.well != null) continue;
    const cell = BOARD[f.id];
    const touch = neighbors(cell.r, cell.c).find((n) => wet.has(n.id));
    if (!touch) continue;
    const cid = compOf.get(touch.id)!;
    used.set(cid, (used.get(cid) ?? 0) + f.demand);
  }
  const spare = new Map<number, number>();
  for (const [id, c] of cap) spare.set(id, c - (used.get(id) ?? 0));
  return { wet, compOf, spare, cap };
}

function blank(year: number, log: string): State {
  return {
    year,
    cash: 80,
    pop: 24,
    granary: 6,
    pipes: [],
    fields: [],
    drained: [],
    terrain: {},
    log: [log],
    order: 1,
    over: false,
    policy: [],
    kibbutzim: [],
    seen: [],
    highlandOpen: false,
    gardens: [],
    linked: [],
    served: [],
    foundedTowns: [],
    kibbutzYear: {},
    gazaLeft: false,
    promisedYear: null,
    fusion: [],
    bought: [],
  };
}

/** Works are legal. Tests and a resumed 1948 use this. The campaign starts earlier. */
export function initialState(): State {
  return blank(1948, "1948. The Mandate is over. The swamp you bought can be dug. The south is still dirt.");
}

/** 1914. Beirut holds the swamp. There is no water policy until the Mandate is over. */
export function campaignState(): State {
  return blank(1914, "1914. Beirut holds the Hula concession. Nobody is digging.");
}

const PLOW: Record<number, [number, number][]> = {
  1921: [
    [17, 7],
    [18, 7],
    [19, 7],
    [17, 12],
    [18, 12],
    [19, 12],
  ],
  1925: [
    [23, 4],
    [24, 4],
    [25, 4],
    [26, 4],
  ],
};

/** The paper's button. One year, no economy, no ditch. Farmland appears when it was bought. */
export function nextPaper(prev: State): State {
  if (prev.year >= 1948) return prev;
  const s = structuredClone(prev);
  if (!s.bought) s.bought = [];
  s.year += 1;
  for (const [r, c] of PLOW[s.year] ?? []) {
    const cell = BOARD.find((x) => x.r === r && x.c === c);
    if (!cell || (cell.terrain !== "desert" && cell.terrain !== "hard")) continue;
    s.terrain[cell.id] = "fertile";
    if (!s.bought.includes(cell.id)) s.bought.push(cell.id);
  }
  if (s.year >= 1948) pushLog(s, "1948. The Mandate is over. The shovel is legal. The swamp is still undug.");
  else pushLog(s, `${s.year}. ${paperFor(s.year).headline}`);
  return s;
}

/** Coast holds a town. A city holds more when farmland sits around it. A well holds one household. */
export function carrying(s: State): number {
  let national = 0;
  let local = 0;
  for (const f of s.fields) {
    if (f.well != null) local += 1;
    else national += 1;
  }
  const cities = cityHold(s).reduce((n, c) => n + c.hold, 0);
  return cities + national * 4 + local + s.drained.length + s.gardens.length * 2 + s.foundedTowns.length * 6;
}

const CITIES = [
  { name: "Tel Aviv", base: 16, weight: 4 },
  { name: "Haifa", base: 12, weight: 4 },
  { name: "Beersheba", base: 2, weight: 3 },
] as const;

function hexesNear(cell: Cell, radius: number): Cell[] {
  const seen = new Set<number>([cell.id]);
  let edge = [cell];
  for (let i = 0; i < radius; i++) {
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
  seen.delete(cell.id);
  return BOARD.filter((c) => seen.has(c.id));
}

function farmRing(s: State, cell: Cell): number {
  return hexesNear(cell, 2).filter((n) => {
    const t = terrainOf(s, n);
    return t === "fertile" || s.fields.some((f) => f.id === n.id) || s.gardens.includes(n.id);
  }).length;
}

const WEIGHT_AT = new Map<number, number>();
for (const { name, weight } of CITIES) {
  const city = BOARD.find((c) => c.name === name)!;
  for (const n of hexesNear(city, 2)) WEIGHT_AT.set(n.id, Math.max(WEIGHT_AT.get(n.id) ?? 0, weight));
}

/** People a watered hex adds because it sits in a city's ring. Zero in open desert. */
export function cityWeightAt(cell: Cell): number {
  return WEIGHT_AT.get(cell.id) ?? 0;
}

/** What each city can hold. Tel Aviv and Haifa start with a garden. Beersheba starts as a market town. */
export function cityHold(s: State): { name: string; hold: number }[] {
  return CITIES.map(({ name, base, weight }) => {
    const cell = BOARD.find((c) => c.name === name)!;
    return { name, hold: base + farmRing(s, cell) * weight };
  });
}

/** Split the people by what the cities can hold. Beersheba stays a market until the pipe or a field arrives. */
export function cityPeople(s: State): { name: string; people: number }[] {
  const beer = BOARD.find((c) => c.name === "Beersheba")!;
  const open = cityHold(s).map((c) =>
    c.name === "Beersheba" && !s.served.includes(beer.id) && farmRing(s, beer) === 0 ? { ...c, hold: 0 } : c,
  );
  const total = open.reduce((n, c) => n + c.hold, 0) || 1;
  let assigned = 0;
  const rows = open.map((c) => {
    const people = Math.floor((s.pop * c.hold) / total);
    assigned += people;
    return { name: c.name, people };
  });
  rows[0].people += s.pop - assigned;
  return rows;
}

export function claimOf(s: State, cell: Cell): "yishuv" | "arab" | "open" {
  if (cell.terrain === "gaza") return s.year >= 1967 && s.year < 2005 ? "open" : "arab";
  if (s.highlandOpen && cell.terrain === "mountain" && cell.claim === "arab") return "open";
  if (s.bought?.includes(cell.id)) return "yishuv";
  if (cell.terrain === "swamp" && cell.claim === "yishuv" && s.year < 1934) return "open";
  if (s.year < 1921 && jezeelDeed(cell)) return "open";
  return cell.claim;
}

/** Ashkelon 2005, then the later coastal plants. Drinking water. Not a second Negev. */
export function desalFlow(year: number): number {
  if (year < 2005) return 0;
  if (year < 2010) return 8;
  if (year < 2013) return 16;
  return 24;
}

/** One fusion plant. The sea becomes a tank. The ditch still has to reach the dirt. */
export const FUSION_FLOW = 50;
export const FUSION_CASH = 80;
export const FUSION_YEAR = 2050;

function pushLog(s: State, line: string) {
  s.log = [line, ...s.log].slice(0, 12);
}

export function pipeCost(s: State, cell: Cell): number | null {
  const t = terrainOf(s, cell);
  if (t === "sea" || t === "salt" || t === "lake" || t === "source" || t === "swamp" || t === "beyond" || t === "river" || t === "rift" || t === "orchard") return null;
  if (s.pipes.includes(cell.id)) return null;
  const cost = PIPE_COST[t];
  return cost ?? null;
}

export function canPipe(s: State, cell: Cell, info = wetInfo(s)): string | null {
  if (s.over) return "The clock has stopped.";
  if (s.year < 1948) return "No water policy under the Mandate. They approved works and did not dig them.";
  if (s.fusion.includes(cell.id)) return "The plant is the tank. Pipe the next hex.";
  if (cell.terrain === "gaza" && claimOf(s, cell) === "arab") {
    return s.year >= 2005 ? "Gaza was left in 2005. The hex stays gray." : "Egypt holds Gaza. Not yours to ditch.";
  }
  if (claimOf(s, cell) === "arab") return "Not your land. The carrier went around the highlands, not through them.";
  const cost = pipeCost(s, cell);
  if (cost == null) return "Cannot lay pipe here.";
  const touch = neighbors(cell.r, cell.c).some((n) => info.wet.has(n.id));
  if (!touch) return "Pipe must touch water or an existing ditch.";
  if (s.cash < cost) return `Need ${il(cost)}.`;
  return null;
}

export function fieldDemand(cell: Cell): number | null {
  if (cell.terrain === "gaza") return 1;
  if (cell.terrain !== "desert" && cell.terrain !== "hard") return null;
  return cell.terrain === "hard" ? 2 : 1;
}

export function wellSpare(s: State, wellId: number): number {
  const used = s.fields.filter((f) => f.well === wellId).reduce((sum, f) => sum + f.demand, 0);
  return 1 - used;
}

/** A kibbutz well waters only an adjacent hex. It is not a pipe, so the carrier cannot start here. */
function adjacentWell(s: State, cell: Cell, demand: number): number | null {
  for (const n of neighbors(cell.r, cell.c)) {
    if (!s.kibbutzim.includes(n.id)) continue;
    if (BOARD[n.id].source) continue;
    if (wellSpare(s, n.id) >= demand) return n.id;
  }
  return null;
}

export function canIrrigate(s: State, cell: Cell, info = wetInfo(s)): string | null {
  if (s.over) return "The clock has stopped.";
  if (s.year < 1948) return "No laterals until the Mandate ends.";
  if (s.fields.some((f) => f.id === cell.id)) return "Already allocated.";
  if (s.kibbutzim.includes(cell.id)) return "That hex is a kibbutz.";
  if (claimOf(s, cell) === "arab") return cell.terrain === "gaza" ? "Gaza is not yours to water." : "Not your land.";
  if (terrainOf(s, cell) !== cell.terrain) return "Not desert.";
  const demand = fieldDemand(cell);
  if (demand == null) return "Only desert takes an allocation.";
  const touch = neighbors(cell.r, cell.c).find(
    (n) => info.wet.has(n.id) && (s.pipes.includes(n.id) || n.terrain === "source" || n.terrain === "lake" || n.reach === "upper" || (n.name === "Ashkelon" && desalFlow(s.year) > 0)),
  );
  if (touch) {
    const spare = info.spare.get(info.compOf.get(touch.id)!) ?? 0;
    if (spare >= demand) {
      if (s.cash < IRRIGATE_CASH) return `Need ${il(IRRIGATE_CASH)} to open the lateral.`;
      return null;
    }
  }
  const well = adjacentWell(s, cell, demand);
  if (well != null) {
    if (s.cash < IRRIGATE_CASH) return `Need ${il(IRRIGATE_CASH)} to open the lateral.`;
    return null;
  }
  if (!touch) return "Needs a ditch, a spring, or a kibbutz on a neighboring hex.";
  const spare = info.spare.get(info.compOf.get(touch.id)!) ?? 0;
  return `That tank has ${spare} spare. This field wants ${demand}. A kibbutz well is only 1, and only next door.`;
}

export function canDrain(s: State, cell: Cell): string | null {
  if (s.over) return "The clock has stopped.";
  if (claimOf(s, cell) === "arab") {
    return s.year >= 1934 && cell.terrain === "swamp" ? "Reserved in the 1934 sale. Not yours to drain." : "Not yours to drain.";
  }
  if (terrainOf(s, cell) !== "swamp") return "Not swamp.";
  if (s.year < 1934) return "Beirut has held this concession since 1914 and has not dug it.";
  if (s.year < 1948) return "You own the concession. They approved it in 1934 and did not dig it.";
  if (s.cash < DRAIN_CASH) return `Need ${il(DRAIN_CASH)} to drain.`;
  return null;
}

export function layPipe(prev: State, id: number): State {
  const s = structuredClone(prev);
  const cell = BOARD[id];
  const err = canPipe(s, cell);
  if (err) {
    pushLog(s, err);
    return s;
  }
  const cost = pipeCost(s, cell)!;
  s.cash -= cost;
  s.pipes.push(id);
  const where = cell.name ?? (terrainOf(s, cell) === "mountain" ? "a tunnel" : "open ground");
  pushLog(s, `${s.year}: pipe on ${where} for ${il(cost)}.`);
  return s;
}

export function irrigate(prev: State, id: number): State {
  const s = structuredClone(prev);
  const cell = BOARD[id];
  const err = canIrrigate(s, cell);
  if (err) {
    pushLog(s, err);
    return s;
  }
  const demand = fieldDemand(cell)!;
  s.cash -= IRRIGATE_CASH;
  const touch = neighbors(cell.r, cell.c).find((n) => wetInfo(s).wet.has(n.id) && (s.pipes.includes(n.id) || n.terrain === "source" || n.terrain === "lake"));
  const info = wetInfo(s);
  const national = touch && (info.spare.get(info.compOf.get(touch.id)!) ?? 0) >= demand;
  const well = national ? undefined : adjacentWell(s, cell, demand) ?? undefined;
  s.fields.push({ id, demand, order: s.order++, well });
  pushLog(s, well != null ? `${s.year}: a kibbutz well watered the next hex. It does not feed the carrier.` : `${s.year}: allocated ${demand} flow. It stays green only while a live ditch touches it.`);
  return s;
}

export function drain(prev: State, id: number): State {
  const s = structuredClone(prev);
  const cell = BOARD[id];
  const err = canDrain(s, cell);
  if (err) {
    pushLog(s, err);
    return s;
  }
  s.cash -= DRAIN_CASH;
  s.drained.push(id);
  s.terrain[id] = "fertile";
  let extra = 0;
  for (const n of neighbors(cell.r, cell.c)) {
    if (n.terrain === "desert" && !s.fields.some((f) => f.id === n.id) && !s.terrain[n.id]) {
      s.terrain[n.id] = "fertile";
      extra++;
    }
  }
  pushLog(s, `${s.year}: swamp drained. The plug lets 1 more flow into the Kinneret.${extra ? ` ${extra} adjacent soft-desert hexes came along as rain-fed.` : ""}`);
  return s;
}

export function kibbutzCost(cell: Cell): number {
  return cell.source ? SPRING_KIBBUTZ_CASH : KIBBUTZ_CASH;
}

export function canKibbutz(s: State, cell: Cell): string | null {
  if (s.over) return "The clock has stopped.";
  if (s.year < 1948) return "A well waits until independence.";
  if (claimOf(s, cell) === "arab") return "That hex is not yours to settle.";
  if (s.kibbutzim.includes(cell.id)) return "Already a kibbutz.";
  const t = terrainOf(s, cell);
  if (t === "sea" || t === "lake" || t === "salt" || t === "beyond" || t === "swamp" || t === "mountain" || t === "river" || t === "rift" || t === "orchard") {
    return "Not ground you can settle.";
  }
  if (t === "urban") return "That is already a town.";
  if (t === "fertile") return "Already a farm. A kibbutz goes on dirt.";
  if (t !== "desert" && t !== "hard") return "Not ground you can settle.";
  if (s.pipes.includes(cell.id)) return "The ditch is already on this hex. Put the kibbutz on the dirt beside it.";
  const seen = new Set<number>([cell.id]);
  let edge = [cell];
  for (let step = 0; step < 2; step++) {
    const next: Cell[] = [];
    for (const cur of edge) {
      for (const n of neighbors(cur.r, cur.c)) {
        if (seen.has(n.id)) continue;
        seen.add(n.id);
        if (s.kibbutzim.includes(n.id)) return "Too close to another kibbutz. The points had gaps.";
        next.push(n);
      }
    }
    edge = next;
  }
  const cost = kibbutzCost(cell);
  if (s.cash < cost) return `Need ${il(cost)} to found it.`;
  return null;
}

export function foundKibbutz(prev: State, id: number): State {
  const s = structuredClone(prev);
  const cell = BOARD[id];
  const err = canKibbutz(s, cell);
  if (err) {
    pushLog(s, err);
    return s;
  }
  s.cash -= kibbutzCost(cell);
  s.kibbutzim.push(id);
  s.kibbutzYear = { ...s.kibbutzYear, [id]: s.year };
  pushLog(
    s,
    cell.source
      ? `${s.year}: kibbutz on ${cell.name ?? "a spring"}. The water was already there. Dirt canals still die in a hex.`
      : `${s.year}: kibbutz and a well. Flow 1, and only the next hex. It is not the carrier.`,
  );
  return s;
}

function carrierTouches(s: State, id: number): boolean {
  const info = wetInfo(s);
  if (s.pipes.includes(id) && info.wet.has(id)) return true;
  const cell = BOARD[id];
  return neighbors(cell.r, cell.c).some((n) => s.pipes.includes(n.id) && info.wet.has(n.id));
}

export function canUpgrade(s: State, cell: Cell): string | null {
  if (s.over) return "The clock has stopped.";
  if (s.year < 1948) return "A town waits until independence.";
  if (!s.kibbutzim.includes(cell.id)) return "Upgrade a kibbutz, not empty dirt.";
  if (terrainOf(s, cell) === "urban") return "Already a town.";
  if (!carrierTouches(s, cell.id)) return "The carrier has not reached this kibbutz.";
  if (s.cash < TOWN_CASH) return `Need ${il(TOWN_CASH)} to make it a town.`;
  return null;
}

export function upgradeTown(prev: State, id: number): State {
  const s = structuredClone(prev);
  const cell = BOARD[id];
  const err = canUpgrade(s, cell);
  if (err) {
    pushLog(s, err);
    return s;
  }
  s.cash -= TOWN_CASH;
  s.kibbutzim = s.kibbutzim.filter((k) => k !== id);
  s.terrain[id] = "urban";
  s.foundedTowns.push(id);
  delete s.kibbutzYear[id];
  pushLog(s, `${s.year}: the kibbutz became a town. The well got rich. A ditch alone is not a town.`);
  return s;
}

export function canFusion(s: State, cell: Cell): string | null {
  if (s.over) return "The clock has stopped.";
  if (s.year < FUSION_YEAR) return "Fusion desalination is not built until 2050.";
  if (s.fusion.includes(cell.id)) return "A plant is already on this hex.";
  if (claimOf(s, cell) === "arab") return "Not your shore.";
  const t = terrainOf(s, cell);
  if (t !== "desert" && t !== "hard" && t !== "fertile") return "Put the plant on open shore, not on a town.";
  if (!neighbors(cell.r, cell.c).some((n) => n.terrain === "sea")) return "Build it against the sea.";
  if (s.cash < FUSION_CASH) return `Need ${il(FUSION_CASH)} to build the plant.`;
  return null;
}

export function buildFusion(prev: State, id: number): State {
  const s = structuredClone(prev);
  const cell = BOARD[id];
  const err = canFusion(s, cell);
  if (err) {
    pushLog(s, err);
    return s;
  }
  s.cash -= FUSION_CASH;
  s.fusion.push(id);
  const where = cell.name ?? `${cell.r},${cell.c}`;
  pushLog(s, `${s.year}: fusion plant on ${where}. Tank of ${FUSION_FLOW}. The ditch still has to reach the dirt.`);
  return s;
}

export function passYear(prev: State): State {
  const s = structuredClone(prev);
  pushLog(s, `${s.year} closed.`);
  return finishYear(s);
}

export function apFor(kind: PolicyKind, cell: Cell): number {
  if (kind === "fusion") return 2;
  if (kind === "kibbutz" || kind === "irrigate" || kind === "drain" || kind === "upgrade") return 1;
  const t = cell.terrain;
  if (t === "mountain" || t === "hard") return 2;
  return 1;
}

export type PolicyLine = {
  index: number;
  kind: PolicyKind;
  id: number;
  label: string;
  cash: number;
  ap: number;
  runningCash: number;
  runningAp: number;
  ok: boolean;
  reason: string | null;
};

function policyLabel(kind: PolicyKind, cell: Cell, cash: number, ap: number): string {
  const where = cell.name ?? `${cell.terrain} ${cell.r},${cell.c}`;
  const verb =
    kind === "pipe" ? "Pipe" : kind === "irrigate" ? "Allocate" : kind === "kibbutz" ? "Kibbutz" : kind === "upgrade" ? "Town" : kind === "fusion" ? "Fusion" : "Drain";
  return `${verb} ${where} · ${il(cash)} · ${ap} AP`;
}

/** Replay the draft onto a copy. Later lines see earlier lines, which is how a ditch walks in one year. */
export function policyLines(prev: State): { lines: PolicyLine[]; projected: State; apUsed: number; cashUsed: number } {
  let projected = structuredClone(prev);
  projected.policy = [];
  let apUsed = 0;
  let cashUsed = 0;
  const cap = yearAp(prev);
  const lines: PolicyLine[] = [];
  for (let index = 0; index < prev.policy.length; index++) {
    const item = prev.policy[index];
    const cell = BOARD[item.id];
    const ap = apFor(item.kind, cell);
    let reason: string | null = null;
    if (!cell) reason = "Missing hex.";
    else if (apUsed + ap > cap) reason = "No action points left.";
    else if (item.kind === "pipe") reason = canPipe(projected, cell);
    else if (item.kind === "irrigate") reason = canIrrigate(projected, cell);
    else if (item.kind === "kibbutz") reason = canKibbutz(projected, cell);
    else if (item.kind === "upgrade") reason = canUpgrade(projected, cell);
    else if (item.kind === "fusion") reason = canFusion(projected, cell);
    else reason = canDrain(projected, cell);
    const cash = !cell
      ? 0
      : item.kind === "pipe"
        ? (pipeCost(projected, cell) ?? 0)
        : item.kind === "irrigate"
          ? IRRIGATE_CASH
          : item.kind === "kibbutz"
            ? kibbutzCost(cell)
            : item.kind === "upgrade"
              ? TOWN_CASH
              : item.kind === "fusion"
                ? FUSION_CASH
                : DRAIN_CASH;
    if (reason || !cell) {
      lines.push({
        index,
        kind: item.kind,
        id: item.id,
        label: cell ? policyLabel(item.kind, cell, cash, ap) : "Missing hex",
        cash,
        ap,
        runningCash: cashUsed,
        runningAp: apUsed,
        ok: false,
        reason,
      });
      continue;
    }
    const next =
      item.kind === "pipe"
        ? layPipe(projected, item.id)
        : item.kind === "irrigate"
          ? irrigate(projected, item.id)
          : item.kind === "kibbutz"
            ? foundKibbutz(projected, item.id)
            : item.kind === "upgrade"
              ? upgradeTown(projected, item.id)
              : item.kind === "fusion"
                ? buildFusion(projected, item.id)
                : drain(projected, item.id);
    projected = next;
    projected.policy = [];
    apUsed += ap;
    cashUsed += cash;
    lines.push({
      index,
      kind: item.kind,
      id: item.id,
      label: policyLabel(item.kind, cell, cash, ap),
      cash,
      ap,
      runningCash: cashUsed,
      runningAp: apUsed,
      ok: true,
      reason: null,
    });
  }
  projected.log = prev.log;
  return { lines, projected, apUsed, cashUsed };
}

export function queueAction(prev: State, kind: PolicyKind, id: number): State {
  const s = structuredClone(prev);
  if (s.over) return s;
  const cell = BOARD[id];
  const { projected, apUsed } = policyLines(s);
  const ap = apFor(kind, cell);
  if (apUsed + ap > yearAp(s)) {
    pushLog(s, "No action points left this year.");
    return s;
  }
  const err =
    kind === "pipe"
      ? canPipe(projected, cell)
      : kind === "irrigate"
        ? canIrrigate(projected, cell)
        : kind === "kibbutz"
          ? canKibbutz(projected, cell)
          : kind === "upgrade"
            ? canUpgrade(projected, cell)
            : kind === "fusion"
              ? canFusion(projected, cell)
              : canDrain(projected, cell);
  if (err) {
    pushLog(s, err);
    return s;
  }
  s.policy.push({ kind, id });
  return s;
}

export function undoPolicy(prev: State): State {
  const s = structuredClone(prev);
  s.policy = s.policy.slice(0, -1);
  return s;
}

export function dropPolicyItem(prev: State, index: number): State {
  const s = structuredClone(prev);
  s.policy = s.policy.filter((_, i) => i !== index);
  return s;
}

export function commitPolicy(prev: State): State {
  const s = structuredClone(prev);
  const { projected, lines } = policyLines(s);
  const ok = lines.filter((line) => line.ok);
  s.cash = projected.cash;
  s.pipes = projected.pipes;
  s.fields = projected.fields;
  s.terrain = projected.terrain;
  s.drained = projected.drained;
  s.kibbutzim = projected.kibbutzim;
  s.foundedTowns = projected.foundedTowns;
  s.kibbutzYear = projected.kibbutzYear;
  s.fusion = projected.fusion;
  s.order = projected.order;
  s.policy = [];
  const spent = ok.reduce((n, line) => n + line.cash, 0);
  const ap = ok.reduce((n, line) => n + line.ap, 0);
  pushLog(s, ok.length ? `${s.year} policy committed. ${il(spent)}, ${ap} AP, ${ok.length} works.` : `${s.year} policy committed. Nothing built.`);
  return finishYear(s, prev.pipes, prev.kibbutzim);
}

function linkKibbutzim(s: State, priorPipes: number[], priorKibbutzim: number[]) {
  const fresh = new Set(s.pipes.filter((id) => !priorPipes.includes(id)));
  if (fresh.size === 0) return;
  const info = wetInfo(s);
  let greened = 0;
  for (const id of s.kibbutzim) {
    if (!priorKibbutzim.includes(id) || s.linked.includes(id)) continue;
    const cell = BOARD[id];
    const arrived = fresh.has(id) || neighbors(cell.r, cell.c).some((n) => fresh.has(n.id) && info.wet.has(n.id));
    if (!arrived) continue;
    s.linked.push(id);
    for (const n of neighbors(cell.r, cell.c)) {
      if (terrainOf(s, n) !== "desert") continue;
      if (s.fields.some((f) => f.id === n.id)) continue;
      if (s.gardens.includes(n.id)) continue;
      s.terrain[n.id] = "fertile";
      s.gardens.push(n.id);
      greened++;
    }
  }
  if (greened > 0) {
    pushLog(s, `${s.year}: a new pipe reached a kibbutz that was already there. ${greened} dirt hexes around it came in green. They do not drink the tank. Founding one does not do this.`);
  }
}

function serveTowns(s: State) {
  for (const cell of BOARD) {
    if (terrainOf(s, cell) !== "urban") continue;
    if (s.served.includes(cell.id)) continue;
    if (!carrierTouches(s, cell.id)) continue;
    s.served.push(cell.id);
    const info = wetInfo(s);
    const cid = info.compOf.get(cell.id);
    let spare = cid == null ? 0 : (info.spare.get(cid) ?? 0);
    const around = neighbors(cell.r, cell.c).filter(
      (n) => n.terrain === "desert" && !s.terrain[n.id] && !s.fields.some((f) => f.id === n.id),
    );
    let opened = 0;
    for (const n of around) {
      if (opened >= 3 || spare < 1) break;
      s.fields.push({ id: n.id, demand: 1, order: s.order++ });
      spare -= 1;
      opened++;
    }
    const name = cell.name ?? "a town";
    if (around.length === 0) pushLog(s, `${s.year}: the carrier reached ${name}. No desert beside it. The ridge does not become a farm.`);
    else if (opened === 0) pushLog(s, `${s.year}: the carrier reached ${name}. The tank had no spare water for the desert.`);
    else pushLog(s, `${s.year}: the carrier reached ${name}. ${opened} desert hexes took water off the tank.`);
  }
}

function landHex(cell: Cell): boolean {
  return cell.terrain !== "sea" && cell.terrain !== "lake" && cell.terrain !== "beyond" && cell.terrain !== "salt" && cell.terrain !== "river" && cell.terrain !== "rift";
}

function madeGreen(s: State, cell: Cell): boolean {
  return s.fields.some((f) => f.id === cell.id) || s.gardens.includes(cell.id) || s.drained.includes(cell.id);
}

/** Prosperous: four watered hexes. A ditch and one farm is a well, not a town. */
function prosperous(s: State, id: number): boolean {
  const made = neighbors(BOARD[id].r, BOARD[id].c).filter((n) => landHex(n) && madeGreen(s, n)).length;
  return made >= 4;
}

/** Another town within three hexes. A carrier lined with kibbutzim is not a city. */
function townNear(s: State, id: number): boolean {
  let edge = [BOARD[id]];
  const seen = new Set<number>([id]);
  for (let step = 0; step < 3; step++) {
    const next: Cell[] = [];
    for (const cur of edge) {
      for (const n of neighbors(cur.r, cur.c)) {
        if (seen.has(n.id)) continue;
        seen.add(n.id);
        if (terrainOf(s, n) === "urban") return true;
        next.push(n);
      }
    }
    edge = next;
  }
  return false;
}

function promoteSettled(s: State): void {
  if (!s.kibbutzYear) s.kibbutzYear = {};
  const eat = Math.ceil(s.pop / 5);
  if (s.granary + foodNow(s) - eat < 3) return;
  const ripe = s.kibbutzim.filter((id) => s.year - (s.kibbutzYear[id] ?? s.year) >= 5 && prosperous(s, id) && !townNear(s, id));
  if (ripe.length === 0) return;
  ripe.sort((a, b) => madeAround(s, b) - madeAround(s, a));
  const id = ripe[0];
  const kept: Field[] = [];
  for (const f of s.fields) {
    if (f.well != null && f.well === id) {
      if (!s.gardens.includes(f.id)) s.gardens.push(f.id);
      continue;
    }
    kept.push(f);
  }
  s.fields = kept;
  s.kibbutzim = s.kibbutzim.filter((k) => k !== id);
  if (!s.foundedTowns.includes(id)) s.foundedTowns.push(id);
  s.terrain[id] = "urban";
  delete s.kibbutzYear[id];
  pushLog(s, `${s.year}: a kibbutz became a town. It stops growing food. The farms around it still do. The ditch does not become a city.`);
}

function madeAround(s: State, id: number): number {
  return neighbors(BOARD[id].r, BOARD[id].c).filter((n) => landHex(n) && madeGreen(s, n)).length;
}

/** Food on the books before anyone moves in. A town that eats its farms is not a town for long. */
function foodNow(s: State): number {
  let rain = 0;
  for (const cell of BOARD) if (terrainOf(s, cell) === "fertile" && !s.fusion.includes(cell.id)) rain += 1;
  let food = Math.floor(rain / 10);
  for (const f of s.fields) food += f.well != null ? 1 : BOARD[f.id].terrain === "hard" ? 1 : 2;
  return food;
}

/** A named city eats one adjacent farm a year. The new town does not eat the next one. That is how a band marched across the valley. */
const TOWN_SEEDS = ["Haifa", "Tel Aviv", "Beersheba", "Ashkelon"];

function spreadTowns(s: State): void {
  if (s.year < 1948) return;
  let grown = 0;
  for (const name of TOWN_SEEDS) {
    const town = BOARD.find((c) => c.name === name);
    if (!town || terrainOf(s, town) !== "urban") continue;
    const farms = neighbors(town.r, town.c).filter((n) => terrainOf(s, n) === "fertile" && !s.kibbutzim.includes(n.id) && !s.fusion.includes(n.id));
    if (farms.length < 3) continue;
    const eat = Math.ceil(s.pop / 5);
    if (s.granary + foodNow(s) - eat < 3) continue;
    const pick = farms[0];
    s.terrain[pick.id] = "urban";
    if (!s.foundedTowns.includes(pick.id)) s.foundedTowns.push(pick.id);
    s.gardens = s.gardens.filter((id) => id !== pick.id);
    s.fields = s.fields.filter((f) => f.id !== pick.id);
    grown++;
  }
  if (grown > 0) pushLog(s, `${s.year}: ${grown} farm hexes beside a city became towns. They do not grow food. A suburb does not found the next suburb.`);
}

function finishYear(s: State, priorPipes: number[] = s.pipes, priorKibbutzim: number[] = s.kibbutzim): State {
  if (s.over) return s;
  // Raids land before the books, so a cut ditch browns fields the same year.
  if (s.year >= 1965 && s.year <= 1975 && s.pipes.length > 1 && s.year % 3 === 0) {
    const hit = s.pipes[s.pipes.length - 1];
    s.pipes = s.pipes.filter((id) => id !== hit);
    pushLog(s, `${s.year}: a raid cut the newest pipe segment.`);
  }

  serveTowns(s);

  const info = wetInfo({ ...s, fields: [] });
  const kept: Field[] = [];
  const ordered = [...s.fields].sort((a, b) => a.order - b.order);
  const used = new Map<number, number>();
  const wellUsed = new Map<number, number>();
  for (const f of ordered) {
    const cell = BOARD[f.id];
    if (f.well != null) {
      const next = (wellUsed.get(f.well) ?? 0) + f.demand;
      const beside = s.kibbutzim.includes(f.well) && neighbors(cell.r, cell.c).some((n) => n.id === f.well);
      if (!beside || next > 1) {
        pushLog(s, `${s.year}: a field browned. The well no longer reaches it.`);
        continue;
      }
      wellUsed.set(f.well, next);
      kept.push(f);
      continue;
    }
    const touch = neighbors(cell.r, cell.c).find((n) => info.wet.has(n.id));
    if (!touch) {
      pushLog(s, `${s.year}: a field browned. The ditch no longer touches it.`);
      continue;
    }
    const cid = info.compOf.get(touch.id)!;
    const next = (used.get(cid) ?? 0) + f.demand;
    if (next > (info.cap.get(cid) ?? 0)) {
      pushLog(s, `${s.year}: flow short. A field browned.`);
      continue;
    }
    used.set(cid, next);
    kept.push(f);
  }
  s.fields = kept;
  linkKibbutzim(s, priorPipes, priorKibbutzim);
  promoteSettled(s);
  spreadTowns(s);

  let food = 0;
  let cashIn = 0;
  let farmPay = 0;
  let rain = 0;
  for (const cell of BOARD) {
    const t = terrainOf(s, cell);
    if (t === "urban") cashIn += s.served.includes(cell.id) ? 10 : 4;
    else if (t === "fertile" && !s.fusion.includes(cell.id)) rain += 1;
  }
  for (const f of s.fields) {
    const cell = BOARD[f.id];
    if (f.well != null) {
      food += 1;
      farmPay += 3;
    } else {
      food += cell.terrain === "hard" ? 1 : 2;
      farmPay += 8;
    }
  }
  cashIn += farmPay;
  food += Math.floor(rain / 10);
  const eat = Math.ceil(s.pop / 5);
  s.granary += food - eat;
  if (s.granary < 0) {
    const short = -s.granary;
    s.pop = Math.max(8, s.pop - short);
    s.granary = 0;
    pushLog(s, `${s.year}: food short by ${short}. People left.`);
  } else {
    if (s.granary > 8) {
      const sold = s.granary - 8;
      s.granary = 8;
      cashIn += sold;
    }
    const room = carrying(s) - s.pop;
    const fed = Math.max(0, food - eat);
    const coast = cityHold(s)
      .filter((c) => c.name !== "Beersheba")
      .reduce((n, c) => n + c.hold, 0);
    const grew = s.fields.length + s.drained.length + s.gardens.length > 0;
    const pull = grew ? 2 + Math.floor(coast / 12) : 0;
    const arrive = Math.min(pull, room, fed);
    if (arrive > 0) {
      s.pop += arrive;
      pushLog(s, `${s.year}: ${arrive} people came for the new land.`);
    }
  }
  s.cash += cashIn;
  if (farmPay > 0) pushLog(s, `${s.year}: watered land paid ${farmPay}.`);
  if (s.promisedYear == null && holdableDirt(s) === 0 && s.fields.length > 0) {
    s.promisedYear = s.year;
    pushLog(s, `${s.year}. Every desert you hold has water. That is as promised as the tanks get.`);
  }
  if (s.year === 1947) pushLog(s, "14 May 1948. The Mandate is over. The swamp you bought can be dug.");
  s.year += 1;
  s.policy = [];
  if (s.year >= 1967 && !s.highlandOpen) {
    s.highlandOpen = true;
    pushLog(s, "1967. The highland is occupied. Gaza can be built on. Sinai is not on this board.");
  }
  if (s.year >= 2005 && !s.gazaLeft) {
    s.gazaLeft = true;
    const gaza = new Set(BOARD.filter((c) => c.terrain === "gaza").map((c) => c.id));
    const had = s.pipes.some((id) => gaza.has(id)) || s.fields.some((f) => gaza.has(f.id));
    s.pipes = s.pipes.filter((id) => !gaza.has(id));
    s.fields = s.fields.filter((f) => !gaza.has(f.id));
    s.kibbutzim = s.kibbutzim.filter((id) => !gaza.has(id));
    for (const id of gaza) delete s.kibbutzYear[id];
    s.gardens = s.gardens.filter((id) => !gaza.has(id));
    pushLog(s, had ? "2005. Gaza is left. What you built there is abandoned." : "2005. Gaza is left. Nothing of yours was on it.");
    pushLog(s, `2005. Ashkelon desalination. Flow ${desalFlow(s.year)} on the coast. The sea serves the cities. It does not finish the desert.`);
  }
  if (s.year === 2050) pushLog(s, "2050. A fusion plant can be built against the sea. Tank of 50. The ditch still has to reach the dirt.");
  return s;
}

function holdableDirt(s: State): number {
  let n = 0;
  for (const cell of BOARD) {
    if (cell.terrain !== "desert" && cell.terrain !== "hard") continue;
    if (claimOf(s, cell) === "arab") continue;
    if (s.fields.some((f) => f.id === cell.id)) continue;
    if (s.terrain[cell.id] === "fertile" || s.gardens.includes(cell.id)) continue;
    n++;
  }
  return n;
}

export function coach(year: number): string {
  if (year < 1921) return "Beirut holds the swamp. There is no water policy. Read the paper.";
  if (year < 1934) return "The valley is farmland now. The swamp is still not yours to dig. Next year.";
  if (year < 1948) return "They approved the swamp in 1934 and did not dig it. No water policy until they leave.";
  if (year < 1953) return "The pipe that matters runs from the Yarkon south to Beersheba. A kibbutz well waters one hex. It is not that pipe. The books are in lira, not dollars.";
  if (year < 1960) return "A kibbutz well waters one hex and holds a few people. The lake, sent west around the green highlands, holds a country.";
  if (year < 1965) return "Soft desert takes 1 flow. Hard desert takes 2. People come up to what the new land can hold.";
  if (year < 2005) return "A raid can cut the newest pipe. Land that browns stops feeding the people who came for it. The Sinai is held and not watered.";
  return "Ashkelon is desalinating the sea. That tank serves people. It does not paint the whole Negev.";
}

export function scoreLine(s: State): string {
  const cap = carrying(s);
  const who = cityPeople(s)
    .map((c) => `${c.name} ${c.people}`)
    .join(", ");
  if (s.fields.length === 0 && s.drained.length === 0) return `${who}. ${s.pop} people. The cities can hold ${cap}. Dirt does not raise that.`;
  return `${who}. ${s.pop} people. The new land can hold ${cap}.`;
}
