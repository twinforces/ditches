export type Paper = {
  year: number;
  headline: string;
  deck: string;
  body: string;
  button: string;
};

const MILESTONE: Record<number, Omit<Paper, "year" | "button">> = {
  1914: {
    headline: "Beirut holds the swamp. The shovel does not.",
    deck: "An Ottoman grant. Malaria on the Jordan. A few farms on the coast.",
    body: "Merchants in Beirut take the concession to drain the Hula. They will hold it for twenty years and not drain it. The coast already has a garden and a town or two. Past that garden the country is dune, rock, and swamp. There is no water policy on this board. A ditch is not a thing you are allowed to draft.",
  },
  1917: {
    headline: "The British arrive. The swamp does not leave.",
    deck: "A new flag over an old concession.",
    body: "Allenby's army is in the country. The concession is still a piece of paper in Beirut. Nobody is surveying a ditch. The farms you can see were here before the war. They are rain. They are not a plan.",
  },
  1918: {
    headline: "The war ends. The Hula does not.",
    deck: "Armistice is not a dredge.",
    body: "The shooting stops. The malaria does not. A correspondent can walk the north end of the Jordan and sink. The merchants who own the right to drain it do not visit.",
  },
  1920: {
    headline: "The Mandate opens an office.",
    deck: "Civil government. Same swamp.",
    body: "London is now the government. It inherits a concession it did not write and does not dig. The English do not have to leave so a swamp can be drained. They will have to leave before it is drained. That is not yet obvious. It will be.",
  },
  1921: {
    headline: "Beirut sells the valley. Not the swamp.",
    deck: "Absentee landlords. The Jezreel changes hands.",
    body: "The Sursock family, in Beirut, sells the Jezreel. The buyers pay the tenants a second time to leave. New farmland hexes come onto your map. They are rain-fed. They are not a ditch. The Hula concession stays with the other Beirut merchants. Still undug.",
  },
  1925: {
    headline: "They buy the dune behind the garden.",
    deck: "More farmland. Still no shovel in the swamp.",
    body: "A strip of soft dune behind the coastal towns is bought and put under the plow. It shows up green because the rain is enough, not because a pipe arrived. Count the years since 1914. The concession is eleven years old. The mud has not moved.",
  },
  1929: {
    headline: "Riots. Not a dredge.",
    deck: "The argument is about people. The swamp is about mud.",
    body: "The papers are full of Hebron and Jerusalem. The Hula is not in them. A swamp does not become a farm because a crowd burned a street. It becomes a farm when somebody digs.",
  },
  1934: {
    headline: "Britain approves the sale. Britain does not dig.",
    deck: "Hansard, 21 December. The concession changes hands.",
    body: "A Jewish company buys the Hula concession from the holders of the 1914 grant. The British government approves the transfer. One hex stays reserved and is not yours. The rest of the swamp is now on your deed, in blue. You still may not draft a drain. They approved the work and left it in the drawer. That is neglect, not a ban. The ditch does not exist.",
  },
  1936: {
    headline: "The revolt starts. The drawer stays shut.",
    deck: "Three years since the approval. Zero ditches.",
    body: "The Arab revolt shuts roads and burns crops. It is a reason a nervous office can give for not starting a dredge. It is not a reason the concession was bought. The swamp is yours on paper. The mud is still mud.",
  },
  1939: {
    headline: "The White Paper freezes the rest of the land.",
    deck: "Purchase of farmland, stopped. The ditch, never started.",
    body: "After this year Jewish land purchase is frozen across most of the country. The farms on the map are the farms you get. No new green hexes. The swamp you already own is not frozen. It is simply not dug. The government that approved it in 1934 has had five years.",
  },
  1940: {
    headline: "Zone A is closed.",
    deck: "Land Transfers Regulations. A lawyer's map, not a ditch.",
    body: "The regulations sort the country into zones. In the closed zone you may not buy. In the other zone you need permission. None of the zones is a dredge on the Jordan. The Hula concession is six years approved and twenty-six years old. Still a swamp.",
  },
  1942: {
    headline: "A world war. The same swamp.",
    deck: "Everyone is busy. The concession is not.",
    body: "Armies cross deserts that are not this board. At home the Hula mosquitoes do what they did in 1914. If incompetence were a banquet it would have been over by now. It is a habit. Another year. No shovel.",
  },
  1945: {
    headline: "The war is over. The ditch is not.",
    deck: "Eleven years since Britain said yes.",
    body: "London has time again. The file is still in the file. You own a swamp, a coastal garden, and a valley bought from Beirut. You are not allowed a water policy. The map is the country. The button is another year of the same paper.",
  },
  1947: {
    headline: "The UN draws a line. The ditch is still a rumor.",
    deck: "Partition. The Arab side rejects the map. The swamp rejects nobody, because nobody dug it.",
    body: "The plan is two states and an international Jerusalem. The Jewish Agency accepts. The Arab Higher Committee and the Arab states reject the whole map. Swamp included. Empty desert included. A line on a map is not a ditch. You have owned this swamp since 1934. They approved it and did not dig it. The English do not have to leave so a swamp can be drained. They have to leave before it will be drained. Push for independence. There is no other move.",
  },
};

const IDLE = [
  "The concession is where it was last year. The Hula is where it was last year. No ditch was dug.",
  "A clerk initialed a minute. The swamp did not read it.",
  "Rain fell on the coast. The coast was already a farm. The north end of the Jordan is still malaria.",
  "No water policy was offered, because none is on offer. The button is the year.",
  "Beirut has the old file, or London has the new file. Neither city is holding a shovel.",
  "The gardens around the towns are still gardens. They were not dug this year. They were inherited.",
  "Another twelve months of competence at everything except the ditch.",
  "You can look at the hexes. You cannot allocate them. That is the whole policy.",
];

export function paperFor(year: number): Paper {
  const hit = MILESTONE[year];
  const button = year >= 1947 ? "Push for Independence" : "Next year";
  if (hit) return { year, ...hit, button };
  const line = IDLE[(year - 1914) % IDLE.length]!;
  return {
    year,
    headline: `${year}. Still not dug.`,
    deck: "The Mandate continues. The shovel does not.",
    body: line,
    button,
  };
}
