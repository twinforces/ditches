import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BOARD, neighbors } from "./board.ts";
import { pendingBrief } from "./events.ts";
import { buildFusion, canDrain, canFusion, canKibbutz, canPipe, campaignState, cityHold, cityPeople, claimOf, commitPolicy, desalFlow, drain, dropPolicyItem, foundKibbutz, initialState, irrigate, layPipe, nextPaper, passYear, policyLines, queueAction, terrainOf, undoPolicy, upgradeTown, wetInfo, YEAR_AP, yearAp } from "./sim.ts";

const kinneret = BOARD.find((c) => c.name === "Kinneret")!;
const yarkon = BOARD.find((c) => c.source === "yarkon")!;
const sea = BOARD.find((c) => c.terrain === "sea")!;

function fertileShore(): (typeof BOARD)[number] {
  for (const lake of BOARD) {
    if (lake.terrain !== "lake" && lake.terrain !== "source") continue;
    for (const n of neighbors(lake.r, lake.c)) {
      if (n.terrain === "fertile") return n;
    }
  }
  throw new Error("no shore");
}

describe("model filters", () => {
  it("refuses the lake and the sea", () => {
    const s = initialState();
    assert.match(canPipe(s, kinneret)!, /Cannot lay pipe/);
    assert.match(canPipe(s, sea)!, /Cannot lay pipe/);
  });

  it("allows a shore hex and refuses land that does not touch water", () => {
    const s = initialState();
    assert.equal(canPipe(s, fertileShore()), null);
    const inland = BOARD.find((c) => c.terrain === "fertile" && canPipe(s, c) != null)!;
    assert.match(canPipe(s, inland)!, /must touch water/);
  });

  it("extends a connected ditch and will not jump a gap", () => {
    let s = initialState();
    const first = fertileShore();
    s = layPipe(s, first.id);
    assert.equal(s.year, 1948);
    const next = neighbors(first.r, first.c).find((n) => canPipe(s, n) == null)!;
    s = layPipe(s, next.id);
    const info = wetInfo(s);
    const gap = BOARD.find((c) => c.terrain === "mountain" && canPipe(s, c, info) != null);
    assert.ok(gap);
  });

  it("keeps Yarkon flow off a Kinneret-only ditch", () => {
    let s = initialState();
    s = layPipe(s, fertileShore().id);
    const info = wetInfo(s);
    const held = BOARD.filter((c) => c.terrain === "swamp" && c.claim === "yishuv").length;
    assert.notEqual(info.compOf.get(kinneret.id), info.compOf.get(yarkon.id));
    assert.equal(info.cap.get(info.compOf.get(kinneret.id)!), 12 - held);
    assert.equal(info.cap.get(info.compOf.get(yarkon.id)!), 3);
  });

  it("fills Nir Am with two soft fields and refuses a third", () => {
    let s = initialState();
    const well = BOARD.find((c) => c.source === "niram")!;
    const deserts = neighbors(well.r, well.c).filter((n) => n.terrain === "desert");
    s = irrigate(s, deserts[0].id);
    s = irrigate(s, deserts[1].id);
    const after = irrigate(s, deserts[2].id);
    assert.equal(after.fields.length, 2);
    assert.match(after.log[0], /spare/);
  });

  it("refuses hard desert on a 1-flow remainder", () => {
    let s = initialState();
    const well = BOARD.find((c) => c.source === "niram")!;
    const deserts = neighbors(well.r, well.c).filter((n) => n.terrain === "desert");
    s = irrigate(s, deserts[0].id);
    const hard = BOARD.find((c) => c.terrain === "hard")!;
    const blocked = irrigate({ ...s, cash: 500 }, hard.id);
    assert.equal(blocked.fields.some((f) => f.id === hard.id), false);
  });

  it("drains swamp into rain-fed and lets one more flow into the lake", () => {
    const swamp = BOARD.find((c) => c.terrain === "swamp" && c.claim === "yishuv")!;
    const before = wetInfo(initialState()).cap.get(wetInfo(initialState()).compOf.get(kinneret.id)!)!;
    const s = drain({ ...initialState(), cash: 200 }, swamp.id);
    assert.equal(s.terrain[swamp.id], "fertile");
    assert.equal(wetInfo(s).wet.has(swamp.id), false);
    assert.equal(wetInfo(s).cap.get(wetInfo(s).compOf.get(kinneret.id)!), before + 1);
    assert.match(s.log[0], /1 more flow/);
  });

  it("browns a field when its only ditch is removed", () => {
    let s = { ...initialState(), cash: 500 };
    const well = BOARD.find((c) => c.source === "niram")!;
    const bridge = neighbors(well.r, well.c).find((n) => n.terrain === "desert")!;
    s = layPipe(s, bridge.id);
    const target = neighbors(bridge.r, bridge.c).find(
      (n) => n.terrain === "desert" && !neighbors(n.r, n.c).some((m) => m.id === well.id),
    )!;
    s = irrigate(s, target.id);
    assert.equal(s.fields.length, 1);
    s = { ...s, pipes: [] };
    s = passYear(s);
    assert.equal(s.fields.length, 0);
    assert.match(s.log.join(" "), /browned/);
  });

  it("cuts the newest segment when a 1965 year closes", () => {
    const shore = fertileShore();
    const next = neighbors(shore.r, shore.c).find((n) => n.terrain === "fertile")!;
    const s = passYear({ ...initialState(), year: 1965, pipes: [shore.id, next.id] });
    assert.equal(s.pipes.length, 1);
    assert.equal(s.year, 1966);
    assert.match(s.log.join(" "), /raid/);
  });

  it("drafts a policy without spending, then commit builds it", () => {
    let s = initialState();
    const first = fertileShore();
    s = queueAction(s, "pipe", first.id);
    const second = neighbors(first.r, first.c).find((n) => policyLines(s).projected && canPipe(policyLines(s).projected, n) == null)!;
    s = queueAction(s, "pipe", second.id);
    assert.equal(s.cash, initialState().cash);
    assert.equal(s.pipes.length, 0);
    const bill = policyLines(s);
    assert.equal(bill.lines.length, 2);
    assert.ok(bill.lines.every((line) => line.ok));
    assert.equal(bill.apUsed, 2);
    assert.equal(bill.cashUsed, bill.lines[0].cash + bill.lines[1].cash);
    s = commitPolicy(s);
    assert.equal(s.year, 1949);
    assert.equal(s.pipes.length, 2);
    assert.match(s.log.join(" "), new RegExp(`${bill.cashUsed} IL, 2 AP`));
    assert.equal(s.policy.length, 0);
  });

  it("refuses a line once the action points are gone", () => {
    let s = { ...initialState(), cash: 500 };
    let guard = 0;
    while (policyLines(s).apUsed < YEAR_AP && guard < 20) {
      const board = policyLines(s).projected;
      const next = BOARD.find((c) => canPipe(board, c) == null);
      assert.ok(next);
      s = queueAction(s, "pipe", next!.id);
      guard++;
    }
    assert.equal(policyLines(s).apUsed, YEAR_AP);
    const extra = BOARD.find((c) => canPipe(policyLines(s).projected, c) == null);
    const refused = queueAction(s, "pipe", extra!.id);
    assert.equal(refused.policy.length, s.policy.length);
    assert.match(refused.log[0], /action points/);
  });

  it("drops a policy line and reprices the bill", () => {
    let s = queueAction(initialState(), "pipe", fertileShore().id);
    s = dropPolicyItem(s, 0);
    assert.equal(s.policy.length, 0);
    assert.equal(policyLines(s).cashUsed, 0);
  });

  it("undo returns the action points", () => {
    let s = queueAction(initialState(), "pipe", fertileShore().id);
    assert.equal(policyLines(s).apUsed, 1);
    s = undoPolicy(s);
    assert.equal(s.policy.length, 0);
    assert.equal(policyLines(s).apUsed, 0);
  });

  it("keeps a running spent column on the policy sheet", () => {
    let s = initialState();
    const first = fertileShore();
    s = queueAction(s, "pipe", first.id);
    const second = neighbors(first.r, first.c).find((n) => canPipe(policyLines(s).projected, n) == null)!;
    s = queueAction(s, "pipe", second.id);
    const lines = policyLines(s).lines;
    assert.equal(lines[0].runningAp, 1);
    assert.equal(lines[1].runningAp, 2);
    assert.equal(lines[1].runningCash, lines[0].cash + lines[1].cash);
  });

  it("a kibbutz well waters one next-door soft desert and does not feed a pipe", () => {
    const site = BOARD.find(
      (c) =>
        c.terrain === "desert" &&
        c.r >= 34 &&
        c.r < 37 &&
        neighbors(c.r, c.c).filter((n) => n.terrain === "desert").length >= 2 &&
        !neighbors(c.r, c.c).some((n) => n.terrain === "source" || n.terrain === "lake"),
    )!;
    let s = foundKibbutz({ ...initialState(), cash: 200 }, site.id);
    assert.equal(wetInfo(s).wet.has(site.id), false);
    const next = neighbors(site.r, site.c).filter((n) => n.terrain === "desert");
    s = irrigate(s, next[0].id);
    assert.equal(s.fields[0].well, site.id);
    const blocked = irrigate(s, next[1].id);
    assert.equal(blocked.fields.length, 1);
    const beside = neighbors(site.r, site.c).find((n) => n.terrain === "desert" || n.terrain === "fertile")!;
    assert.notEqual(canPipe(s, beside), null);
  });

  it("does not bill a well field to the lake", () => {
    const s = initialState();
    const before = [...wetInfo(s).spare.values()].reduce((sum, n) => sum + n, 0);
    const desert = BOARD.find((c) => c.terrain === "desert")!;
    const after = wetInfo({ ...s, fields: [{ id: desert.id, demand: 1, order: 1, well: 1 }] });
    const spare = [...after.spare.values()].reduce((sum, n) => sum + n, 0);
    assert.equal(spare, before);
    assert.ok(spare > 0);
  });

  it("grows a brown town out of a farm beside a city, and stops when the food is gone", () => {
    const haifa = BOARD.find((c) => c.name === "Haifa")!;
    const farms = neighbors(haifa.r, haifa.c).filter((n) => n.terrain === "fertile");
    assert.ok(farms.length >= 3);
    let fed = passYear({ ...initialState(), granary: 20, pop: 10 });
    assert.ok(fed.foundedTowns.some((id) => farms.some((f) => f.id === id)));
    assert.equal(fed.terrain[fed.foundedTowns.find((id) => farms.some((f) => f.id === id))!], "urban");
    const hungry = passYear({ ...initialState(), granary: 0, pop: 200 });
    assert.equal(hungry.foundedTowns.length, 0);
  });

  it("turns a prosperous kibbutz into a town, and leaves a single farm as a well", () => {
    const site = BOARD.find(
      (c) => c.terrain === "desert" && neighbors(c.r, c.c).filter((n) => n.terrain === "desert").length >= 4,
    )!;
    let s = foundKibbutz({ ...initialState(), cash: 400 }, site.id);
    const farm = neighbors(site.r, site.c).find((n) => n.terrain === "desert")!;
    s.gardens = [farm.id];
    s.kibbutzYear[site.id] = s.year - 5;
    s = passYear(s);
    assert.equal(s.foundedTowns.includes(site.id), false);
    s.gardens = neighbors(site.r, site.c)
      .filter((n) => n.terrain === "desert")
      .slice(0, 4)
      .map((n) => n.id);
    s.kibbutzYear[site.id] = s.year - 5;
    s = passYear(s);
    assert.equal(s.kibbutzim.includes(site.id), false);
    assert.ok(s.foundedTowns.includes(site.id));
  });

  it("will not line the ditch with towns", () => {
    const town = BOARD.find((c) => c.name === "Beersheba")!;
    const site = neighbors(town.r, town.c).find((n) => n.terrain === "desert" || n.terrain === "hard");
    if (!site) return;
    let s = foundKibbutz({ ...initialState(), cash: 400 }, site.id);
    s.gardens = neighbors(site.r, site.c)
      .filter((n) => n.terrain === "desert" || n.terrain === "fertile" || n.terrain === "hard")
      .slice(0, 4)
      .map((n) => n.id);
    s.kibbutzYear[site.id] = s.year - 5;
    s = passYear(s);
    assert.equal(s.kibbutzim.includes(site.id), true);
    assert.equal(s.foundedTowns.includes(site.id), false);
  });

  it("builds a fusion tank on the shore in 2050 and will not pipe the plant itself", () => {
    const shore = BOARD.find((c) => c.terrain === "desert" && neighbors(c.r, c.c).some((n) => n.terrain === "sea"))!;
    let s = { ...initialState(), year: 2049, cash: 200 };
    assert.match(canFusion(s, shore) ?? "", /2050/);
    s = { ...s, year: 2050 };
    s = buildFusion(s, shore.id);
    const info = wetInfo(s);
    assert.equal(info.cap.get(info.compOf.get(shore.id)!), 50);
    assert.match(canPipe(s, shore) ?? "", /tank/);
  });

  it("adds the well's flow to a ditch, and will not found a kibbutz on a farm", () => {
    const fertile = BOARD.find((c) => c.terrain === "fertile")!;
    assert.match(canKibbutz({ ...initialState(), cash: 400 }, fertile) ?? "", /farm/);
    const link = BOARD.find((c) => c.r === 22 && c.c === 8)!;
    const site = BOARD.find((c) => c.r === 23 && c.c === 8)!;
    let s = layPipe({ ...initialState(), cash: 400 }, link.id);
    const before = wetInfo(s).spare.get(wetInfo(s).compOf.get(link.id)!) ?? 0;
    s = foundKibbutz(s, site.id);
    const info = wetInfo(s);
    assert.equal(info.wet.has(site.id), false);
    assert.equal(info.spare.get(info.compOf.get(link.id)!), before + 1);
  });

  it("will not dig until the Mandate ends, and will not dig the reserved swamp", () => {
    const owned = BOARD.find((c) => c.terrain === "swamp" && c.claim === "yishuv")!;
    const reserved = BOARD.find((c) => c.terrain === "swamp" && c.claim === "arab")!;
    const early = campaignState();
    assert.equal(early.year, 1914);
    assert.match(canDrain(early, owned) ?? "", /Beirut/);
    const held = { ...early, year: 1947 };
    assert.match(canDrain(held, owned) ?? "", /1934/);
    const free = passYear(held);
    assert.equal(free.year, 1948);
    assert.equal(canDrain(free, owned), null);
    assert.match(canDrain(held, reserved) ?? "", /Reserved/);
  });

  it("refuses a pipe across the highland", () => {
    const ridge = BOARD.find((c) => c.terrain === "mountain" && c.claim === "arab")!;
    assert.match(canPipe(initialState(), ridge) ?? "", /highlands/);
  });

  it("will not found a kibbutz on a town or against another kibbutz", () => {
    const haifa = BOARD.find((c) => c.name === "Haifa")!;
    assert.match(canKibbutz({ ...initialState(), cash: 500 }, haifa) ?? "", /town/);
    const dirt = BOARD.find((c) => c.terrain === "desert" && c.r > 24 && c.c > 4 && c.c < 12)!;
    const founded = foundKibbutz({ ...initialState(), cash: 500 }, dirt.id);
    const beside = neighbors(dirt.r, dirt.c).find((n) => n.terrain === "desert")!;
    assert.match(canKibbutz(founded, beside) ?? "", /close/);
    const hold = cityHold(initialState());
    assert.ok(hold.find((c) => c.name === "Tel Aviv")!.hold > hold.find((c) => c.name === "Beersheba")!.hold);
    assert.ok(hold.find((c) => c.name === "Haifa")!.hold > hold.find((c) => c.name === "Beersheba")!.hold);
    assert.equal(cityPeople(initialState()).find((c) => c.name === "Beersheba")!.people, 0);
  });

  it("joins the upper Jordan to the Kinneret and does not tap the river below the lake", () => {
    const upper = BOARD.find((c) => c.name === "Jordan")!;
    const lower = BOARD.find((c) => c.name === "Lower Jordan")!;
    const info = wetInfo(initialState());
    assert.equal(info.compOf.get(upper.id), info.compOf.get(kinneret.id));
    assert.equal(info.wet.has(lower.id), false);
    assert.ok(BOARD.filter((c) => c.r === lower.r && c.c > lower.c).every((c) => c.terrain === "beyond"));
    assert.ok(BOARD.filter((c) => c.r === upper.r && c.c > upper.c).every((c) => c.terrain === "beyond"));
    const arava = BOARD.find((c) => c.name === "Arava")!;
    assert.equal(arava.terrain, "rift");
    assert.ok(BOARD.filter((c) => c.r === arava.r && c.c > arava.c).every((c) => c.terrain === "beyond"));
  });

  it("buys another action after four watered hexes, and people come for real desert", () => {
    const rich = {
      ...initialState(),
      fields: [0, 1, 2, 3].map((id) => ({ id, demand: 1, order: 1 })),
    };
    assert.equal(yearAp(initialState()), YEAR_AP);
    assert.equal(yearAp(rich), YEAR_AP + 1);
    const idle = passYear(initialState());
    assert.equal(idle.pop, initialState().pop);
    assert.doesNotMatch(idle.log.join(" "), /came for/);
    const well = BOARD.find((c) => c.source === "niram")!;
    const deserts = neighbors(well.r, well.c).filter((n) => n.terrain === "desert");
    let watered = irrigate({ ...initialState(), cash: 200 }, deserts[0].id);
    watered = irrigate(watered, deserts[1].id);
    watered = passYear(watered);
    assert.ok(watered.pop > initialState().pop);
    assert.match(watered.log.join(" "), /came for the new land/);
  });

  it("starts in 1914, adds the valley in 1921, and opens the shovel in 1948", () => {
    const valley = BOARD.find((c) => c.r === 18 && c.c === 9 && c.terrain === "fertile")!;
    const s = campaignState();
    assert.equal(pendingBrief(s), null);
    assert.equal(terrainOf(s, valley), "desert");
    assert.equal(claimOf(s, valley), "open");
    let y = s;
    while (y.year < 1921) y = nextPaper(y);
    assert.equal(terrainOf(y, valley), "fertile");
    assert.equal(claimOf(y, valley), "yishuv");
    assert.ok(y.bought.length > 0);
    while (y.year < 1948) y = nextPaper(y);
    assert.equal(y.year, 1948);
    assert.equal(pendingBrief(y)?.id, "independence");
    assert.equal(canDrain(y, BOARD.find((c) => c.terrain === "swamp" && c.claim === "yishuv")!), null);
  });

  it("opens the highland in 1967 without farming it, and does not stop the year", () => {
    let s = initialState();
    while (s.year < 1967) s = passYear(s);
    assert.equal(s.highlandOpen, true);
    assert.equal(s.over, false);
    const ridge = BOARD.find((c) => c.terrain === "mountain" && c.claim === "arab")!;
    assert.equal(claimOf(s, ridge), "open");
    assert.equal(ridge.terrain, "mountain");
    assert.doesNotMatch(canPipe({ ...s, cash: 900 }, ridge) ?? "", /Not your land/);
    while (s.year < 1982) s = passYear(s);
    assert.equal(s.over, false);
    assert.equal(s.year, 1982);
    while (s.year < 2016) s = passYear(s);
    assert.equal(s.over, false);
    assert.equal(s.year, 2016);
  });

  it("labels the neighbors, lets you build Gaza after 1967, and takes it back in 2005 when the sea becomes a tank", () => {
    assert.equal(BOARD.find((c) => c.name === "Lebanon")?.terrain, "beyond");
    assert.equal(BOARD.find((c) => c.name === "Syria")?.terrain, "beyond");
    assert.ok(BOARD.some((c) => c.name === "Jordan" && c.terrain === "beyond"));
    assert.equal(BOARD.find((c) => c.name === "Egypt")?.terrain, "beyond");
    const gaza = BOARD.filter((c) => c.terrain === "gaza");
    const egypt = BOARD.find((c) => c.name === "Egypt")!;
    assert.equal(gaza.length, 2);
    assert.ok(gaza.every((g) => neighbors(g.r, g.c).some((n) => n.id === egypt.id)));
    let s = initialState();
    assert.match(canPipe({ ...s, cash: 900 }, gaza[0]) ?? "", /Egypt holds Gaza/);
    while (s.year < 1967) s = passYear(s);
    assert.equal(claimOf(s, gaza[0]), "open");
    assert.doesNotMatch(canPipe({ ...s, cash: 900 }, gaza[0]) ?? "", /Egypt holds Gaza/);
    while (s.year < 2005) s = passYear(s);
    assert.equal(s.gazaLeft, true);
    assert.equal(claimOf(s, gaza[0]), "arab");
    assert.equal(desalFlow(s.year), 8);
    const ash = BOARD.find((c) => c.name === "Ashkelon")!;
    assert.ok(wetInfo(s).wet.has(ash.id));
    assert.equal(wetInfo(s).cap.get(wetInfo(s).compOf.get(ash.id)!), 8);
  });

  it("keeps a garden around the coastal towns and not around Beersheba", () => {
    const haifa = BOARD.find((c) => c.name === "Haifa")!;
    const beer = BOARD.find((c) => c.name === "Beersheba")!;
    assert.ok(neighbors(haifa.r, haifa.c).some((n) => n.terrain === "fertile"));
    assert.equal(neighbors(beer.r, beer.c).some((n) => n.terrain === "fertile"), false);
  });

  it("greens the dirt around a kibbutz when the carrier arrives", () => {
    let s = { ...initialState(), cash: 800 };
    let shore: (typeof BOARD)[number] | undefined;
    let site: (typeof BOARD)[number] | undefined;
    for (const c of BOARD) {
      if (c.terrain !== "desert") continue;
      const touch = neighbors(c.r, c.c).find(
        (n) => n.terrain === "fertile" && neighbors(n.r, n.c).some((k) => k.terrain === "lake" || k.terrain === "source" || k.reach === "upper"),
      );
      const more = neighbors(c.r, c.c).filter((n) => n.terrain === "desert");
      if (touch && more.length > 0) {
        shore = touch;
        site = c;
        break;
      }
    }
    assert.ok(shore && site);
    s = foundKibbutz(s, site.id);
    s = passYear(s);
    assert.equal(s.gardens.length, 0);
    s = commitPolicy(queueAction(s, "pipe", shore.id));
    assert.ok(s.gardens.length > 0);
    assert.ok(s.gardens.every((id) => s.terrain[id] === "fertile"));
    assert.ok(s.linked.includes(site.id));
  });

  it("keeps olive groves off your ditch, and Jerusalem in the rocks", () => {
    const grove = BOARD.find((c) => c.terrain === "orchard")!;
    assert.equal(grove.claim, "arab");
    assert.match(canPipe(initialState(), grove) ?? "", /Not your land/);
    const jerusalem = BOARD.find((c) => c.name === "Jerusalem")!;
    assert.ok(neighbors(jerusalem.r, jerusalem.c).filter((n) => n.terrain === "mountain").length >= 2);
  });

  it("makes a kibbutz on the carrier a town, and a piped town takes desert off the tank", () => {
    let s = { ...initialState(), cash: 800 };
    const site = BOARD.find(
      (c) =>
        c.terrain === "desert" &&
        neighbors(c.r, c.c).some((n) => n.terrain === "fertile" && neighbors(n.r, n.c).some((k) => k.terrain === "lake" || k.reach === "upper")),
    )!;
    const shore = neighbors(site.r, site.c).find((n) => n.terrain === "fertile")!;
    s = layPipe(s, shore.id);
    s = foundKibbutz(s, site.id);
    s = upgradeTown(s, site.id);
    assert.equal(s.terrain[site.id], "urban");
    assert.equal(s.kibbutzim.includes(site.id), false);
    assert.ok(s.foundedTowns.includes(site.id));

    const beer = BOARD.find((c) => c.name === "Beersheba")!;
    const kinneret = BOARD.find((c) => c.name === "Kinneret")!;
    let ditch = { ...initialState(), cash: 5000 };
    for (let i = 0; i < 40; i++) {
      const info = wetInfo(ditch);
      const kid = info.compOf.get(kinneret.id);
      const opts = BOARD.filter(
        (c) => canPipe(ditch, c) == null && neighbors(c.r, c.c).some((n) => info.compOf.get(n.id) === kid),
      );
      if (!opts.length) break;
      const touching = opts.find((c) => neighbors(c.r, c.c).some((n) => n.id === beer.id));
      opts.sort((a, b) => Math.abs(a.r - beer.r) + Math.abs(a.c - beer.c) - (Math.abs(b.r - beer.r) + Math.abs(b.c - beer.c)));
      ditch = layPipe(ditch, (touching ?? opts[0]).id);
      if (neighbors(beer.r, beer.c).some((n) => ditch.pipes.includes(n.id))) break;
    }
    ditch = passYear(ditch);
    assert.ok(ditch.served.includes(beer.id));
    const taken = ditch.fields.filter((f) => neighbors(beer.r, beer.c).some((n) => n.id === f.id));
    assert.ok(taken.length > 0 && taken.length <= 3);
  });
});
