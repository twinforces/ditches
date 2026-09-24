# Ditches and Desert

What: A hex sim of water, then land, then people. The campaign opens in 1914 as a newspaper. No water policy, and the books do not move. Farmland appears when it is bought. 1947's only button is Push for Independence. The shovel is legal in 1948. The Sinai goes back in 1982. Desalination starts in 2005. The year does not stop.

Why: The coast already feeds a small population. Dirt does not. People arrive only up to what new land can hold.

How:
- Model: `src/game/model/board.ts` and `src/game/model/sim.ts`. View model: `src/game/viewmodel/present.ts`.
- A year is a draft. Commit builds the lines, then the books close.
- You start at 2 action points. Every 4 carrier fields or drained hexes adds one, up to 6. A kibbutz well does not.
- Raids cut the newest pipe from 1965 through 1975. After that the ditch stays. From 2050 a fusion plant on a shore hex is a tank of 50. Plants sit apart along the coast, up to six. A plant does not green the dirt until a pipe carries it, and a tank that already touches dirt pours before it lays another empty segment.
- A city eats one adjacent farm a year, and only while food is spare. The new town does not eat the next farm. A kibbutz with four farms becomes a town only if no town is already within three hexes, and only one a year. That is a development town, not a band along the carrier.
- Towns pay a little. Rain-fed land feeds you and pays nothing. A carrier field pays 8. A well field pays 3.
- The Jordan north of the lake is the Kinneret's water. South of the lake the river is the eastern border and not a tap.
- Kinneret flow is 12 once the swamp is open. Each Hula hex still in the way holds 1 of that back. Yarkon is 3. Nir Am is 2. Soft desert takes 1. Hard desert takes 2, which a well cannot pay.
- From 1914 through 1947 the bottom of the board is The Palestine Gazette. Next year does not run the economy. 1921 and 1925 put bought farmland on the map. 1934 is Britain approving the Hula sale and not digging it. 1947 is Push for Independence, which opens 1948. A card then stops for the invasion, the 1956 Sinai trip, the first raids, 1967, 1973, the 1982 withdrawal, and 2005 desalination. Wars change what you may dig. They do not turn dirt green. Lebanon, Syria, Jordan, and Egypt are labeled and not playable. Gaza is two gray hexes: buildable from 1967, abandoned in 2005.
- The books are Israeli lira (IL). The shekel is 1980.
- Olive orchards sit on the west face of the ridge. They are already land, and not yours.
- The hint scores each option in people and lira. A pipe toward Beersheba wins when moving water you already have pays more than opening the swamp. Draining Hula wins when that extra flow is worth more than another segment. It is not aimed there by name. A kibbutz is one household and loses both. Kibbutzim still cannot sit on adjacent hexes.
- Tel Aviv and Haifa already have a garden, so they can hold a city. Beersheba is a Bedouin market until that pipe arrives. Farmland within two hexes raises what a city can hold. People move in only after new land exists.

Run `npm test`.
