import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/game/Shell";

export const Route = createFileRoute("/note")({
  component: NotePage,
});

function NotePage() {
  return (
    <Shell>
      <article className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-8">
        <h1 className="display text-3xl">Author's Note</h1>
        <p>
          I grew up in Southern California, and I lived in Arizona. The conventional wisdom of the Palestinians is that the Jews that moved to Israel in 1947 "wanted their land". I've always been skeptical of that narrative after driving between Flagstaff, AZ and Los Angeles, CA every holiday for years. There's a lot of shitty land. Israel, to this day, is mostly shitty desert.
        </p>
        <p>Desert isn't land. You have to make it land. That means digging irrigation ditches not foxholes. Can you make Israel green?</p>
        <p>
          History is written by the machinery, and the machinery is driven by the incentives. All that blather about victors is nonsense. $ talks, BS walks. The land is owned by the people who push the shovel into the dirt, not by the people who push swords into bellies.
        </p>
      </article>
    </Shell>
  );
}
