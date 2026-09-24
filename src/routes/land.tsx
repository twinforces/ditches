import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/game/Shell";
import { FILL } from "@/game/viewmodel/present";

export const Route = createFileRoute("/land")({
  component: LandPage,
});

const ROWS: { terrain: string; swatch: string; people: string; drink: string; provide: string; cost: string; farm?: boolean; well?: boolean; plant?: boolean }[] = [
  {
    terrain: "Soft desert",
    swatch: FILL.desert,
    people: "4 on the carrier. 1 if a well waters it. In a city ring, the city holds more too.",
    drink: "1",
    provide: "Nothing until watered. Then 8 IL and 2 food a year.",
    cost: "Pipe 20 IL, 1 AP. Water 14 IL, 1 AP. Kibbutz 36 IL, 1 AP.",
  },
  {
    terrain: "Hard desert",
    swatch: FILL.hard,
    people: "4 on the carrier. A well cannot pay for it.",
    drink: "2",
    provide: "8 IL and 1 food a year, once the carrier waters it.",
    cost: "Pipe 30 IL, 2 AP. Water 14 IL, 1 AP.",
  },
  {
    terrain: "Fertile",
    swatch: FILL.fertile,
    farm: true,
    people: "Does not hold a household by itself. Inside two hexes of a city, Tel Aviv and Haifa hold 4 more, Beersheba 3.",
    drink: "0",
    provide: "Rain. Ten fertile hexes make 1 food. Pays nothing.",
    cost: "Pipe 16 IL, 1 AP.",
  },
  {
    terrain: "Kibbutz",
    swatch: FILL.fertile,
    farm: true,
    well: true,
    people: "1 household. Four farms around it, and no town already close, and it becomes a town. The town is brown.",
    drink: "1",
    provide: "Well of 1, only the next hex. Beside a wet pipe it adds 1 to that pipe. A well field pays 3 IL and 1 food.",
    cost: "36 IL, 1 AP. On a spring, 20 IL. Not on a farm, and not on the ditch.",
  },
  {
    terrain: "Swamp",
    swatch: FILL.swamp,
    people: "1, once drained. It stays rain-fed after that.",
    drink: "0",
    provide: "Opening one hex lets 1 more flow into the Kinneret. The hex is not a tank.",
    cost: "Drain 18 IL, 1 AP. The reserved hex is not yours. You cannot pipe a swamp.",
  },
  {
    terrain: "Lake",
    swatch: FILL.lake,
    people: "0",
    drink: "0",
    provide: "The Kinneret is 12 when the swamp is open. While Hula holds the Jordan back, you only have what is left.",
    cost: "Nothing. You do not build on the lake.",
  },
  {
    terrain: "Spring",
    swatch: FILL.source,
    people: "0",
    drink: "0",
    provide: "Yarkon 3. Nir Am 2. A kibbutz here is a well of 1, and only the next hex.",
    cost: "Kibbutz on a spring 20 IL, 1 AP. You cannot pipe the spring itself.",
  },
  {
    terrain: "River",
    swatch: FILL.river,
    people: "0",
    drink: "0",
    provide: "Above the lake it is the Kinneret's tank. Below the lake it is the border, and not a tap.",
    cost: "Nothing. You do not ditch the river.",
  },
  {
    terrain: "Town",
    swatch: FILL.urban,
    people: "Tel Aviv starts at 16, Haifa at 12, Beersheba at 2. A kibbutz with four farms around it becomes a town, unless a town is already nearby. The ditch does not turn into a city. A city eats one adjacent farm a year while food is spare. The new town does not eat the next one. A town is brown. It does not grow food.",
    drink: "0",
    provide: "4 IL a year, 10 if the carrier has reached it. The pipe can water up to 3 desert hexes beside it. From 2005 Ashkelon adds desalinated flow: 8, then 16, then 24.",
    cost: "Pipe 16 IL, 1 AP. Making a kibbutz a town early is 48 IL, 1 AP, and the carrier has to be there. Five prosperous years do it free. Autoplay does not buy it.",
  },
  {
    terrain: "Mountain",
    swatch: FILL.mountain,
    people: "0. Jerusalem sits in the ridge and has no tank.",
    drink: "0",
    provide: "Nothing. The highland does not become a farm.",
    cost: "A tunnel is 48 IL, 2 AP, and only after 1967. Before that the ridge is not yours.",
  },
  {
    terrain: "Orchard",
    swatch: FILL.orchard,
    people: "0. Already land, and not yours.",
    drink: "0",
    provide: "Already green. Not a ditch you dug.",
    cost: "Nothing. You cannot pipe it or settle it.",
  },
  {
    terrain: "Gaza",
    swatch: FILL.gaza,
    people: "4 while you hold it and the carrier waters it.",
    drink: "1",
    provide: "Same pay as a soft field, and only while you are there.",
    cost: "Pipe 20 IL, 1 AP, from 1967 to 2005. Then the works come out.",
  },
  {
    terrain: "Sea",
    swatch: FILL.sea,
    people: "0",
    drink: "0",
    provide: "Nothing by itself. Ashkelon, the town, is what desalts it.",
    cost: "Nothing. You do not build on the sea. From 2050 a fusion plant on the shore next to it is 80 IL and 2 AP. Tank of 50.",
  },
  {
    terrain: "Fusion plant",
    swatch: FILL.lake,
    plant: true,
    people: "0. It is a tank, not a town.",
    drink: "0",
    provide: "A tank of 50. Nothing grows until a ditch carries it onto dirt.",
    cost: "80 IL, 2 AP, on a shore hex, from 2050. You do not pipe the plant itself.",
  },
  {
    terrain: "Dead Sea",
    swatch: FILL.salt,
    people: "0",
    drink: "0",
    provide: "Salt. Not a tank.",
    cost: "Nothing.",
  },
  {
    terrain: "Arava",
    swatch: FILL.rift,
    people: "0",
    drink: "0",
    provide: "Dry border, south of the Dead Sea.",
    cost: "Nothing.",
  },
  {
    terrain: "Beyond",
    swatch: FILL.beyond,
    people: "0",
    drink: "0",
    provide: "Lebanon, Syria, Jordan, Egypt. Labeled, not playable.",
    cost: "Nothing.",
  },
];

function sampleHex(): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${18 + 14 * Math.cos(angle)},${18 + 14 * Math.sin(angle)}`);
  }
  return pts.join(" ");
}

function HexSample({ fill, farm, well, plant, id }: { fill: string; farm?: boolean; well?: boolean; plant?: boolean; id: string }) {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true">
      {farm && (
        <defs>
          <pattern id={id} patternUnits="userSpaceOnUse" width="36" height="36">
            <image href="/tex/fertile.jpg" width="36" height="36" preserveAspectRatio="xMidYMid slice" />
          </pattern>
        </defs>
      )}
      <polygon points={sampleHex()} fill={farm ? `url(#${id})` : fill} stroke="#1c1914" strokeWidth="1.2" />
      {well && <circle cx="18" cy="16" r="3.4" fill="#f3ead7" stroke="#1c1914" strokeWidth="0.9" />}
      {plant && (
        <g transform="translate(18, 18) scale(0.62) translate(-12, -12)" fill="none" stroke="#f4efe4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10.5" fill="#14384a" stroke="none" />
          <path d="M12 12h.01" />
          <path d="M7.5 4.2c-.3-.5-.9-.7-1.3-.4C3.9 5.5 2.3 8.1 2 11c-.1.5.4 1 1 1h5c0-1.5.8-2.8 2-3.4-1.1-1.9-2-3.5-2.5-4.4z" />
          <path d="M21 12c.6 0 1-.4 1-1-.3-2.9-1.8-5.5-4.1-7.1-.4-.3-1.1-.2-1.3.3-.6.9-1.5 2.5-2.6 4.3 1.2.7 2 2 2 3.5h5z" />
          <path d="M7.5 19.8c-.3.5-.1 1.1.4 1.3 2.6 1.2 5.6 1.2 8.2 0 .5-.2.7-.8.4-1.3-.5-.9-1.4-2.5-2.5-4.3-1.2.7-2.8.7-4 0-1.1 1.8-2 3.4-2.5 4.3z" />
        </g>
      )}
    </svg>
  );
}

function LandPage() {
  return (
    <Shell>
      <article className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8">
        <h1 className="display text-3xl">Land</h1>
        <p className="text-sm text-[var(--color-muted)]">
          People is how many the hex can hold. Drink is flow it takes from a tank. Provide is what it adds each year. Cost is what you pay to work it. A well's one flow is not the lake.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)]/30">
                <th className="py-2 pr-3 font-medium">Hex</th>
                <th className="py-2 pr-3 font-medium">Terrain</th>
                <th className="py-2 pr-3 font-medium">People</th>
                <th className="py-2 pr-3 font-medium">Drink</th>
                <th className="py-2 pr-3 font-medium">Provide</th>
                <th className="py-2 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.terrain} className="border-b border-[var(--color-line)]/15 align-top">
                  <td className="py-2 pr-3">
                    <HexSample fill={row.swatch} farm={row.farm} well={row.well} plant={row.plant} id={`land-${row.terrain.replace(/\s/g, "-")}`} />
                  </td>
                  <th className="py-2 pr-3 font-medium">{row.terrain}</th>
                  <td className="py-2 pr-3">{row.people}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{row.drink}</td>
                  <td className="py-2 pr-3">{row.provide}</td>
                  <td className="py-2">{row.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </Shell>
  );
}