import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BOARD, neighbors } from "../model/board.ts";
import { ackBrief } from "../model/events.ts";
import { campaignState, commitPolicy, initialState, queueAction, wetInfo, yearAp, type PolicyKind, type State } from "../model/sim.ts";
import { suggestNext, playHint } from "./suggest.ts";

function quiet(s: State): State {
  for (const id of ["partition", "concession", "independence", "sinai", "raids", "sixday", "october", "withdrawal", "desal", "end"]) s = ackBrief(s, id);
  return s;
}

describe("next move", () => {
  it("tells 1947 to read the card, then to commit", () => {
    const card = suggestNext(campaignState());
    assert.equal(card.kind, "wait");
    assert.match(card.text, /card/);
    const hint = suggestNext(quiet(campaignState()));
    assert.equal(hint.kind, "commit");
    assert.equal(hint.id, null);
    assert.match(hint.text, /1934/);
    assert.match(hint.text, /did not dig/);
    assert.match(hint.text, /independence/);
  });

  it("spends the first move on the city pipe, not the northern riverbank", () => {
    const hint = suggestNext(quiet(initialState()));
    assert.notEqual(hint.kind, "kibbutz");
    assert.notEqual(hint.kind, "drain");
    assert.ok(hint.id != null);
    const lake = BOARD.find((c) => c.source === "kinneret")!;
    const cell = BOARD[hint.id!];
    assert.ok(cell.r > lake.r);
    assert.match(hint.text, /Tel Aviv|Beersheba|city|garden/);
  });

  it("opens the Hula before it founds a well", () => {
    let s = quiet(initialState());
    for (let n = 0; n < 40 && s.drained.length === 0; n++) {
      const hint = suggestNext(s);
      assert.notEqual(hint.kind, "kibbutz");
      assert.notEqual(hint.kind, "wait");
      if (hint.kind === "commit") {
        s = commitPolicy(s);
        continue;
      }
      assert.ok(hint.id != null);
      const before = s.policy.length;
      s = queueAction(s, hint.kind as PolicyKind, hint.id);
      if (s.policy.length === before) s = commitPolicy(s);
    }
    assert.ok(s.drained.length > 0);
  });

  it("says commit once the year's points are queued", () => {
    let s = quiet(initialState());
    const budget = yearAp(s);
    for (let i = 0; i < budget; i++) {
      const hint = suggestNext(s);
      assert.notEqual(hint.kind, "commit");
      assert.notEqual(hint.kind, "wait");
      assert.ok(hint.id != null);
      const before = s.policy.length;
      s = queueAction(s, hint.kind as PolicyKind, hint.id);
      assert.equal(s.policy.length, before + 1);
    }
    const done = suggestNext(s);
    assert.equal(done.kind, "commit");
    assert.match(done.text, /Commit/);
  });

  it("lays the pipe toward Beersheba before it founds a kibbutz", () => {
    let s = quiet(initialState());
    const beer = BOARD.find((c) => c.name === "Beersheba")!;
    let pipes = 0;
    let kibbutz = false;
    for (let n = 0; n < 120 && !s.served.includes(beer.id); n++) {
      const hint = suggestNext(s);
      assert.notEqual(hint.kind, "kibbutz");
      if (hint.kind === "kibbutz") kibbutz = true;
      if (hint.kind === "commit") {
        s = commitPolicy(s);
        continue;
      }
      assert.notEqual(hint.kind, "wait");
      assert.ok(hint.id != null);
      if (hint.kind === "pipe") pipes += 1;
      const before = s.policy.length;
      s = queueAction(s, hint.kind as PolicyKind, hint.id);
      if (s.policy.length === before) s = commitPolicy(s);
    }
    assert.equal(kibbutz, false);
    assert.ok(pipes > 3);
    assert.ok(s.served.includes(beer.id));
  });

  it("plays the hinted action, and stops when the clock has stopped", () => {
    const start = quiet(initialState());
    const next = playHint(start);
    assert.ok(next);
    assert.equal(next.policy.length, 1);
    assert.equal(next.year, start.year);
    assert.equal(playHint({ ...start, over: true, year: 1970 }), null);
  });

  it("does not lay a pipe across farmland just to spend the point", () => {
    const beer = BOARD.find((c) => c.name === "Beersheba")!;
    const seen = new Set<number>([beer.id]);
    let edge = [beer];
    for (let i = 0; i < 2; i++) {
      const next = [];
      for (const cur of edge) {
        for (const n of neighbors(cur.r, cur.c)) {
          if (seen.has(n.id)) continue;
          seen.add(n.id);
          next.push(n);
        }
      }
      edge = next;
    }
    const drained = BOARD.filter((c) => c.terrain === "swamp" && c.claim === "yishuv").map((c) => c.id);
    const terrain: Record<number, "fertile"> = {};
    for (const id of seen) {
      const cell = BOARD[id];
      if (cell.terrain === "desert" || cell.terrain === "hard") terrain[id] = "fertile";
    }
    for (const id of drained) terrain[id] = "fertile";
    let s: State = {
      ...quiet(initialState()),
      cash: 19,
      drained,
      terrain,
    };
    const info = wetInfo(s);
    let need = [...info.cap.values()].reduce((sum, n) => sum + n, 0);
    const fields = [];
    for (const cell of BOARD) {
      if (need <= 0) break;
      const demand = cell.terrain === "hard" ? 2 : cell.terrain === "desert" ? 1 : null;
      if (demand == null || demand > need) continue;
      if (!neighbors(cell.r, cell.c).some((n) => info.wet.has(n.id))) continue;
      fields.push({ id: cell.id, demand, order: fields.length + 1 });
      need -= demand;
    }
    s = { ...s, fields };
    const poured = wetInfo(s);
    for (const [comp, left] of poured.spare) {
      if (left <= 0) continue;
      const host = BOARD.find(
        (c) => !s.fields.some((f) => f.id === c.id) && neighbors(c.r, c.c).some((n) => poured.compOf.get(n.id) === comp),
      );
      if (!host) continue;
      s.fields.push({ id: host.id, demand: left, order: s.fields.length + 1 });
    }
    const hint = suggestNext(s);
    assert.equal(hint.kind, "commit");
  });
});
