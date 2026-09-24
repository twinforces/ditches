import type { State } from "./sim.ts";

export type Brief = { id: string; kicker: string; title: string; body: string };

const SCRIPT: Brief[] = [
  {
    id: "partition",
    kicker: "November 1947",
    title: "The UN draws a line. The Arab side rejects it.",
    body: "The plan is two states and an international Jerusalem. The Jewish Agency accepts. The Arab Higher Committee and the Arab states reject the whole map. Swamp included. Empty desert included. A line on a map is not a ditch. Dirt nobody watered is not a farm yet.",
  },
  {
    id: "concession",
    kicker: "1934",
    title: "You bought the swamp.",
    body: "The Hula concession is already yours, bought from the holders of the 1914 grant. Britain approved it in 1934 and did not dig it. That was neglect, not a ban. The towns sit in a garden. Past that garden the country is dirt, and it stays dirt until water moves.",
  },
  {
    id: "independence",
    kicker: "15 May 1948",
    title: "The armies come in.",
    body: "The day after the declaration, Egypt, Transjordan, Syria, Lebanon, and Iraq invade. There is no Palestinian state when the armistices are signed. Jordan holds the ridge, the West Bank. Egypt holds Gaza. The desert inside your line is still dirt. The person who digs the well is the person who owns it.",
  },
  {
    id: "sinai",
    kicker: "1956",
    title: "Sinai, and back.",
    body: "Israel took the Sinai and Gaza in the Suez war, then left by March 1957. This board did not move. No hex was watered.",
  },
  {
    id: "raids",
    kicker: "1965",
    title: "The ditch is a target.",
    body: "A raid can cut the newest pipe when the year closes. Land past the gap goes brown. People leave with the food.",
  },
  {
    id: "sixday",
    kicker: "1967",
    title: "The highland is in your hands.",
    body: "The army took the West Bank, Gaza, the Sinai, and the Golan. On this board that is the ridge. You can dig it. It is rock. The Sinai is not on this board, and no ditch was laid there. The desert you can green is the desert you already held.",
  },
  {
    id: "october",
    kicker: "1973",
    title: "The canal, not a ditch.",
    body: "Egypt crossed the Suez Canal. When the shooting stopped, Israel still held the Sinai. It was a buffer. It was not land. Land is what you water.",
  },
  {
    id: "withdrawal",
    kicker: "25 April 1982",
    title: "Sinai goes back.",
    body: "The 1979 treaty handed it back in stages. The last strip returns today. Yamit is bulldozed. The carrier was never in it. The ridge on this board stays occupied. Gaza stays, for now. The clock does not stop. The sea is not a farm yet.",
  },
  {
    id: "desal",
    kicker: "2005",
    title: "Leave the gray hexes. The sea becomes a tank.",
    body: "Gaza is abandoned. Anything you built on those two hexes comes out. The same year Ashkelon starts desalting the Mediterranean. Flow 8, then more as later plants open. That water is for the cities. The Negev is still dirt until a ditch reaches it, and the ditch still ends when the flow ends.",
  },
];

const YEAR: Record<string, number> = {
  partition: 1947,
  concession: 1947,
  independence: 1948,
  sinai: 1956,
  raids: 1965,
  sixday: 1967,
  october: 1973,
  withdrawal: 1982,
  desal: 2005,
};

export function pendingBrief(s: State): Brief | null {
  if (s.over && !s.seen.includes("end")) {
    const watered = s.fields.length;
    return {
      id: "end",
      kicker: String(s.year),
      title: "The argument is on the board.",
      body:
        watered > 0
          ? `${watered} watered deserts. ${s.pop} people. The coast started at 24. ${s.promisedYear != null ? `The dirt you could water was done by ${s.promisedYear}.` : "Most of the desert never got a ditch."} Desal served the cities. Sinai went back unwatered.`
          : `No watered desert. ${s.pop} people. The dirt stayed dirt.`,
    };
  }
  for (const brief of SCRIPT) {
    if (s.year >= YEAR[brief.id] && !s.seen.includes(brief.id)) return brief;
  }
  return null;
}

export function ackBrief(prev: State, id: string): State {
  if (prev.seen.includes(id)) return prev;
  const s = structuredClone(prev);
  s.seen.push(id);
  return s;
}
