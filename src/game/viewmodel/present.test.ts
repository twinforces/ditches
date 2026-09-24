import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BOARD, neighbors } from "../model/board.ts";
import { initialState, irrigate, layPipe } from "../model/sim.ts";
import { FILL, present } from "./present.ts";

describe("view model filters", () => {
  it("paints an allocated desert green, and hard desert is not that green", () => {
    const well = BOARD.find((c) => c.source === "niram")!;
    const desert = neighbors(well.r, well.c).find((n) => n.terrain === "desert")!;
    const s = irrigate({ ...initialState(), cash: 100 }, desert.id);
    const view = present(s, null);
    const farmed = view.cells.find((c) => c.id === desert.id)!;
    assert.equal(farmed.fill, "url(#tex-fertile)");
    assert.equal(farmed.title, "Farmed");
    assert.equal(farmed.facts.find((f) => f.k === "Land")!.v, "Farmed");
    assert.notEqual(farmed.fill, FILL.hard);
    const hard = view.cells.find((c) => BOARD[c.id].terrain === "hard")!;
    const soft = view.cells.find((c) => BOARD[c.id].terrain === "desert" && c.id !== desert.id)!;
    assert.equal(hard.fill, FILL.hard);
    assert.equal(soft.fill, FILL.desert);
    assert.notEqual(hard.fill, soft.fill);
    const lake = view.cells.find((c) => c.name === "Kinneret")!;
    assert.equal(lake.facts.find((f) => f.k === "Land")!.v, "Lake");
    assert.equal(lake.facts.find((f) => f.k === "Tank")!.v, "1 of 12. The swamp holds the rest");
    const grove = view.cells.find((c) => BOARD[c.id].terrain === "orchard")!;
    assert.equal(grove.facts.find((f) => f.k === "Land")!.v, "Olive orchard");
    assert.equal(grove.facts.find((f) => f.k === "Held")!.v, "Not yours");
    assert.equal(view.cells.find((c) => c.id === desert.id)!.facts.find((f) => f.k === "Water")!.v, "Allocated, drinks 1");
  });

  it("marks only ditchable hexes legal, never sea or lake", () => {
    const view = present(initialState(), null);
    const legal = view.cells.filter((c) => c.legal);
    assert.ok(legal.length > 0);
    for (const c of legal) {
      const t = BOARD[c.id].terrain;
      assert.notEqual(t, "sea");
      assert.notEqual(t, "lake");
    }
  });

  it("disables pipe on a dry inland hex and explains why", () => {
    const s = initialState();
    const inland = BOARD.find((c) => c.terrain === "fertile" && present(s, c.id).actions.some((a) => a.id === "pipe" && a.disabled))!;
    const pipe = present(s, inland.id).actions.find((a) => a.id === "pipe")!;
    assert.equal(pipe.disabled, true);
    assert.match(pipe.reason!, /touch water/);
  });

  it("enables pipe on a fertile shore and selects it with a dark stroke", () => {
    const s = initialState();
    const shore = BOARD.find((c) => present(s, c.id).actions.some((a) => a.id === "pipe" && !a.disabled))!;
    const view = present(s, shore.id);
    assert.equal(view.cells.find((c) => c.id === shore.id)!.stroke, "#1c1914");
  });

  it("shows drain on swamp and allocate on desert", () => {
    const swamp = BOARD.find((c) => c.terrain === "swamp")!;
    const desert = BOARD.find((c) => c.terrain === "desert")!;
    const a = present({ ...initialState(), cash: 200 }, swamp.id);
    const b = present(initialState(), desert.id);
    assert.ok(a.actions.some((x) => x.id === "drain" && !x.disabled));
    assert.equal(b.actions.some((x) => x.id === "drain"), false);
    assert.ok(b.actions.some((x) => x.id === "irrigate"));
  });

  it("shows a new pipe as wet without closing the year", () => {
    const s0 = initialState();
    const shore = BOARD.find((c) => present(s0, c.id).actions.some((a) => a.id === "pipe" && !a.disabled))!;
    const s = layPipe(s0, shore.id);
    const cell = present(s, shore.id).cells.find((c) => c.id === shore.id)!;
    assert.equal(cell.piped, true);
    assert.equal(cell.wet, true);
    assert.equal(s.year, 1948);
  });
});
