import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/game/Shell";

const SOURCES: { title: string; href: string; note: string }[] = [
  {
    title: "Concession changes hands in Palestine",
    href: "https://www.nytimes.com/1934/12/03/archives/concession-changes-hands-in-palestine-lake-huleh-rights-transferred.html",
    note: "New York Times, 3 December 1934. The Lake Huleh concession, granted to an Arab group in 1914, is transferred to a Jewish group. 15,000 acres reserved for Arab occupation. Drainage is announced and does not happen.",
  },
  {
    title: "Israeli pound",
    href: "https://en.wikipedia.org/wiki/Israeli_pound",
    note: "The Palestine pound runs until 1952, then the Israeli lira (IL), one for one. The shekel replaces it in 1980. This sim's books say IL. Olive groves on the highland slopes are the orchard hexes: already land, not a ditch you dug.",
  },
  {
    title: "Tower and stockade",
    href: "https://en.wikipedia.org/wiki/Tower_and_stockade",
    note: "1936-1939. About 57 settlements planted overnight as facts on the ground. Kibbutzim were a fence. The water works were not. The hint sends ditches toward Tel Aviv and kibbutzim toward the frontier, the south more than the north.",
  },
  {
    title: "11 points in the Negev",
    href: "https://en.wikipedia.org/wiki/11_points_in_the_Negev",
    note: "October 1946. Eleven settlements went up overnight so the Negev would be on the partition map. A kibbutz on the hint prefers the south over the northern riverbank.",
  },
  {
    title: "Egypt–Israel peace treaty",
    href: "https://en.wikipedia.org/wiki/Egypt%E2%80%93Israel_peace_treaty",
    note: "Signed 1979. Israel had held the Sinai since 1967, after a short occupation in 1956–57. The National Water Carrier was not built there. Withdrawal finished on 25 April 1982. Yamit was demolished. The clock keeps going.",
  },
  {
    title: "United Nations Partition Plan for Palestine",
    href: "https://en.wikipedia.org/wiki/United_Nations_Partition_Plan_for_Palestine",
    note: "Resolution 181, 29 November 1947. Two states and an international Jerusalem. The Jewish Agency accepted. The Arab Higher Committee and the Arab states rejected the whole map.",
  },
  {
    title: "1948 Arab–Israeli War",
    href: "https://en.wikipedia.org/wiki/1948_Arab%E2%80%93Israeli_War",
    note: "Civil war from the partition vote, then on 15 May 1948 the armies of Egypt, Transjordan, Syria, Lebanon, and Iraq invade. The armistices leave Jordan holding the West Bank and Egypt holding Gaza. No Palestinian state.",
  },
  {
    title: "Israeli disengagement from Gaza",
    href: "https://en.wikipedia.org/wiki/Israeli_disengagement_from_Gaza",
    note: "Summer 2005. The settlements come out. On this board the two gray hexes can be built on from 1967 and are emptied in 2005.",
  },
  {
    title: "Ashkelon desalination plant",
    href: "https://en.wikipedia.org/wiki/Ashkelon_desalination_plant",
    note: "Opened 2005, about 118 million cubic meters a year. Later plants at Palmachim, Hadera, and Sorek raise the coastal tank. It supplies cities. It is not a second National Water Carrier for the Negev.",
  },
  {
    title: "Yarkon-Negev pipeline",
    href: "https://en.wikipedia.org/wiki/National_Water_Carrier_of_Israel",
    note: "The Yarkon-Negev line opened in 1955 and carried spring water south to the Negev, including Beersheba. The National Water Carrier, opened in 1964, then fed that system from the Kinneret. The hint builds that order: Yarkon south, then the lake into the line.",
  },
  {
    title: "Beersheba",
    href: "https://en.wikipedia.org/wiki/Beersheba",
    note: "The Negev's Bedouin market town under the Ottomans and the Mandate. Most of the town's population left in 1948. Bedouin who remained in the Negev became citizens. The city grew on the pipeline, not on a well in every dune.",
  },
  {
    title: "Jewish land purchase in Palestine",
    href: "https://en.wikipedia.org/wiki/Jewish_land_purchase_in_Palestine",
    note: "By 1945 Jewish buyers held about 5.67 percent of the Mandate. Much of what they held had been swamp, dune, or uncultivated. The Peel Commission said the shortage of land was less about those purchases than about population.",
  },
  {
    title: "National Water Carrier of Israel",
    href: "https://en.wikipedia.org/wiki/National_Water_Carrier_of_Israel",
    note: "Opened 1964. The Jordan above the lake is that tank. The carrier pumps at Sapir, then the Eilabun tunnel, Beit Netofa, and the line to Rosh HaAyin. It does not follow the river south. Below the lake the Jordan runs to the Dead Sea, saltier, and it is the border.",
  },
  {
    title: "Satellite image of Israel, January 2003",
    href: "https://commons.wikimedia.org/wiki/File:Satellite_image_of_Israel_in_January_2003.jpg",
    note: "NASA, public domain. Hex textures are cut from it. Green in the desert, mountain, and swamp cuts is pushed back to dirt, because 2003 is greener than 1947. The photo is not stretched under the grid.",
  },
  {
    title: "Draining Israel's Hula Valley",
    href: "https://www.biu.ac.il/en/article/9627",
    note: "Bar-Ilan. The lake and swamp were drained by 30 October 1957. Work ran 1951-1959 in this telling. Twelve swamp hexes and 2 action points a year are scaled off that job.",
  },
  {
    title: "Huleh drainage is completed",
    href: "https://www.jta.org/archive/huleh-drainage-israels-largest-development-project-is-completed",
    note: "Jewish Telegraphic Agency, 1 November 1957. Last barrier blown. JNF started in 1951. About 15,000 acres, and water saved for irrigation farther south. The game puts 1 flow into the Kinneret per hex opened.",
  },
  {
    title: "Israel is draining swamps for farms",
    href: "https://www.nytimes.com/1953/08/18/archives/israel-is-draining-swamps-for-farms-ancient-huleh-lake-area-will.html",
    note: "New York Times, 18 August 1953. Solel Boneh had been widening the Jordan since 1951. The paper guessed ten years to clear the reeds.",
  },
  {
    title: "Ecosystem service trade-offs in wetland management: the Hula",
    href: "https://www.tandfonline.com/doi/abs/10.1080/02626667.2011.631013",
    note: "Cohen-Shacham et al., Hydrological Sciences Journal, 2011. Drainage dated 1951-1958. The concession goes back to 1934.",
  },
  {
    title: "Focus on Israel: development of limited water resources",
    href: "https://web.archive.org/web/20071011032150/http://mfa.gov.il/mfa/facts%20about%20israel/land/focus%20on%20israel-%20development%20of%20limited%20water%20reso",
    note: "Israel Ministry of Foreign Affairs, via the Internet Archive. Springs moved in open dirt canals and died in the ground. Coastal wells were shallow. The first Negev pipeline, 1947, came from the northwestern Negev well field. The National Water Carrier came later, from the Kinneret.",
  },
  {
    title: "Agriculture as a tool against desertification",
    href: "https://www.jewishvirtuallibrary.org/jsource/agriculture/agdes.html",
    note: "Jewish Virtual Library. Local Negev wells were small and often too salty. The dependable supply was a pipe from the north.",
  },
];

export const Route = createFileRoute("/receipts")({
  component: ReceiptsPage,
});

function ReceiptsPage() {
  return (
    <Shell>
      <article className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
        <h1 className="display text-3xl">Receipts</h1>
        <p className="text-sm text-[var(--color-muted)]">Sources actually consulted for this sim. Not a bibliography of the conflict.</p>
        <ol className="flex flex-col gap-4">
          {SOURCES.map((source) => (
            <li key={source.href}>
              <a href={source.href} className="underline">
                {source.title}
              </a>
              <p className="mt-1 text-sm text-[var(--color-muted)]">{source.note}</p>
            </li>
          ))}
        </ol>
      </article>
    </Shell>
  );
}
