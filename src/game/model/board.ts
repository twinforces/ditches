/** Fine board, about six times the first sketch. North is row 0. No missing hexes. */

export type Terrain =
  | "sea"
  | "lake"
  | "source"
  | "urban"
  | "orchard"
  | "river"
  | "fertile"
  | "swamp"
  | "desert"
  | "hard"
  | "mountain"
  | "salt"
  | "rift"
  | "gaza"
  | "beyond";

export type SourceId = "kinneret" | "yarkon" | "niram";

export type Claim = "yishuv" | "arab" | "open";

export type Cell = {
  id: number;
  r: number;
  c: number;
  terrain: Terrain;
  source?: SourceId;
  flow: number;
  name?: string;
  /** Who held the ground in 1947. Open is crown waste or unclaimed desert, not a deed. */
  claim: Claim;
  /** Upper Jordan joins the Kinneret. Lower Jordan runs to the Dead Sea and is not the tap. */
  reach?: "upper" | "lower";
};

export const COLS = 28;
export const ROWS = 44;

function coast(r: number): number {
  if (r < 6) return 4;
  if (r < 12) return 2;
  if (r < 40) return 1;
  return 8;
}

function eastEdge(r: number): number {
  // The Jordan is the eastern border. East of it is Transjordan, not this board.
  // The line is the river, the east shore of the lake, the Dead Sea, then the Arava to the gulf.
  if (r <= 8) return 17;
  if (r <= 13) return 18;
  if (r <= 15) return 19;
  if (r <= 21) return 20;
  if (r <= 30) return 22;
  if (r <= 32) return 21;
  if (r <= 34) return 19;
  if (r <= 37) return 18;
  if (r <= 40) return 16;
  return 15;
}

type Spot = { terrain: Terrain; flow?: number; source?: SourceId; name?: string; reach?: "upper" | "lower" };

function spot(r: number, c: number): Spot {
  const west = coast(r);
  const east = eastEdge(r);
  if (c < west || c > east) {
    if (r > 40 && c >= 8 && c <= 16) return { terrain: "sea" };
    if (r === 0 && c === 19) return { terrain: "beyond", name: "Syria" };
    if (r === 18 && c === 22) return { terrain: "beyond", name: "Jordan" };
    return { terrain: c < west ? "sea" : "beyond" };
  }

  // Gulf of Eilat
  if (r >= 41 && c >= 13 && c <= 15) return { terrain: "sea" };

  // Dead Sea
  if (r >= 22 && r <= 30 && c >= 21 && c <= 24) return { terrain: "salt" };

  // The Jordan. Upper reach is the same tank as the lake. Lower reach leaves the lake and is not a tap.
  const reach = jordanReach(r, c);
  if (reach === "upper") return { terrain: "river", reach, name: r === 3 && c === 17 ? "Jordan" : undefined };
  if (reach === "lower") return { terrain: "river", reach, name: r === 18 && c === 20 ? "Lower Jordan" : undefined };

  // South of the Dead Sea the same border is the Arava, dry, down to the gulf.
  if (r >= 31 && r <= 40 && c === east) return { terrain: "rift", name: r === 34 ? "Arava" : undefined };

  // Hula swamp, with a fertile bank on both sides so the ditch can leave.
  if (r >= 5 && r <= 8 && c >= 14 && c <= 16) return { terrain: "swamp", name: r === 6 && c === 15 ? "Hula" : undefined };

  // Kinneret. One hex carries the tank. Shore hexes around it stay land.
  if (r >= 9 && r <= 13 && c >= 15 && c <= 18) {
    if (r === 11 && c === 16) return { terrain: "lake", flow: 12, source: "kinneret", name: "Kinneret" };
    return { terrain: "lake" };
  }

  // Ridge. Leave column 14 and column 19 as passes.
  const ridge = c >= 16 && c <= 20 && r >= 14 && r <= 32 && c !== 18;
  if (ridge && !(r >= 22 && r <= 30 && c >= 21)) return { terrain: "mountain" };

  if (r === 16 && c === 5) return { terrain: "urban", name: "Haifa" };
  if (r === 22 && c === 6) return { terrain: "urban", name: "Tel Aviv" };
  if (r === 22 && c === 9) return { terrain: "source", flow: 3, source: "yarkon", name: "Yarkon" };
  if (r === 24 && c === 18) return { terrain: "urban", name: "Jerusalem" };
  if (r === 34 && c === 10) return { terrain: "urban", name: "Beersheba" };
  if (r === 33 && c === 7) return { terrain: "source", flow: 2, source: "niram", name: "Nir Am" };
  if (r === 31 && c === 2) return { terrain: "urban", name: "Ashkelon" };
  if (r === 35 && c === 1) return { terrain: "gaza", name: "Gaza" };
  if (r === 36 && c === 2) return { terrain: "gaza" };
  if (r === 0 && c === 7) return { terrain: "beyond", name: "Lebanon" };
  if (r === 36 && c === 1) return { terrain: "beyond", name: "Egypt" };

  // Olive groves on the west face of the ridge, and a Galilee strip. Already land. Not the player's ditch.
  if (orchardAt(r, c)) return { terrain: "orchard" };

  // Rain-fed is the exception. The coast already eats. The lake has a bank.
  // Everything else north of the hard desert is still dirt. You build the rest.
  if (rainFed(r, c)) return { terrain: "fertile" };
  if (r < 37) return { terrain: "desert" };
  return { terrain: "hard" };
}

function jordanReach(r: number, c: number): "upper" | "lower" | null {
  if (c === 17 && r >= 1 && r <= 8) return "upper";
  if (r === 14 && (c === 18 || c === 19)) return "lower";
  if (r === 15 && c === 19) return "lower";
  if (c === 20 && r >= 16 && r <= 21) return "lower";
  return null;
}

function orchardAt(r: number, c: number): boolean {
  if (c === 15 && r >= 16 && r <= 31) return true;
  if (c === 13 && r >= 4 && r <= 10) return true;
  return false;
}

function rainFed(r: number, c: number): boolean {
  const west = coast(r);
  if (r >= 14 && r <= 27 && c >= west && c <= west + 2) return true;
  if (r >= 17 && r <= 19 && c >= 8 && c <= 11) return true;
  if (r >= 8 && r <= 14 && c >= 14 && c <= 19) return true;
  return false;
}

function claimAt(r: number, c: number, terrain: Terrain): Claim {
  // 1934: the Hula concession, bought from the holders of the 1914 Ottoman grant.
  // The same deal reserved a slice for Arab occupation. That hex is not yours to drain.
  if (terrain === "swamp") return r === 8 && c === 16 ? "arab" : "yishuv";
  if (terrain === "gaza") return "arab";
  // The ridge is the highland. The 1964 carrier went around it, not through it.
  if (terrain === "orchard") return "arab";
  if (terrain === "mountain") return "arab";
  if ((r === 16 && c === 5) || (r === 22 && c === 6) || (r === 33 && c === 7)) return "yishuv";
  // Jezreel, the Sursock purchases: a few hexes, not the whole coast.
  if (r >= 17 && r <= 19 && c >= 7 && c <= 11 && terrain === "fertile") return "yishuv";
  return "open";
}

export const BOARD: Cell[] = [];
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const s = spot(r, c);
    BOARD.push({
      id: r * COLS + c,
      r,
      c,
      terrain: s.terrain,
      flow: s.flow ?? 0,
      source: s.source,
      name: s.name,
      claim: claimAt(r, c, s.terrain),
      reach: s.reach,
    });
  }
}

const GARDEN_TOWNS = new Set(["Haifa", "Tel Aviv"]);
for (const town of BOARD) {
  if (!town.name || !GARDEN_TOWNS.has(town.name)) continue;
  for (const n of neighbors(town.r, town.c)) {
    if (n.terrain === "desert") n.terrain = "fertile";
  }
}

export function cellAt(r: number, c: number): Cell | undefined {
  if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return undefined;
  return BOARD[r * COLS + c];
}

/** Odd-r offset. Odd rows are shifted right, matching the drawing. */
export function neighbors(r: number, c: number): Cell[] {
  const deltas =
    (r & 1) === 0
      ? [
          [0, -1],
          [0, 1],
          [-1, -1],
          [-1, 0],
          [1, -1],
          [1, 0],
        ]
      : [
          [0, -1],
          [0, 1],
          [-1, 0],
          [-1, 1],
          [1, 0],
          [1, 1],
        ];
  const out: Cell[] = [];
  for (const [dr, dc] of deltas) {
    const n = cellAt(r + dr, c + dc);
    if (n) out.push(n);
  }
  return out;
}
