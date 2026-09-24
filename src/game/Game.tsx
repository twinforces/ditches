import { useEffect, useState } from "react";
import { CircleHelp, Droplets, Radiation, RotateCcw, Shovel } from "lucide-react";
import { COLS, ROWS } from "./model/board.ts";
import { campaignState, commitPolicy, dropPolicyItem, nextPaper, queueAction, undoPolicy, type State } from "./model/sim.ts";
import { ackBrief } from "./model/events.ts";
import { ALLOCATED, FILL, present } from "./viewmodel/present.ts";
import { playHint, suggestNext } from "./viewmodel/suggest.ts";
import { Shell } from "./Shell";

const SAVE = "ditches-desert-v10";
const HEX = 14;

function hexPoints(cx: number, cy: number, size: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`);
  }
  return pts.join(" ");
}

function center(r: number, c: number): [number, number] {
  const x = HEX * Math.sqrt(3) * (c + 0.5 * (r & 1)) + HEX;
  const y = HEX * 1.5 * r + HEX;
  return [x, y];
}

/** Radiation trefoil, the mark for a fusion tank. Same blades as the Lucide icon. */
function FusionMark({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx}, ${cy}) scale(0.5) translate(-12, -12)`} fill="none" stroke="#f4efe4" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10.5" fill="#14384a" stroke="none" />
      <path d="M12 12h.01" />
      <path d="M7.5 4.2c-.3-.5-.9-.7-1.3-.4C3.9 5.5 2.3 8.1 2 11c-.1.5.4 1 1 1h5c0-1.5.8-2.8 2-3.4-1.1-1.9-2-3.5-2.5-4.4z" />
      <path d="M21 12c.6 0 1-.4 1-1-.3-2.9-1.8-5.5-4.1-7.1-.4-.3-1.1-.2-1.3.3-.6.9-1.5 2.5-2.6 4.3 1.2.7 2 2 2 3.5h5z" />
      <path d="M7.5 19.8c-.3.5-.1 1.1.4 1.3 2.6 1.2 5.6 1.2 8.2 0 .5-.2.7-.8.4-1.3-.5-.9-1.4-2.5-2.5-4.3-1.2.7-2.8.7-4 0-1.1 1.8-2 3.4-2.5 4.3z" />
    </g>
  );
}

export function Game() {
  const [state, setState] = useState<State | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [hover, setHover] = useState<{ id: number; x: number; y: number } | null>(null);
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    let next = campaignState();
    try {
      const raw = localStorage.getItem(SAVE);
      if (raw) {
        const parsed = JSON.parse(raw) as State;
        if (parsed.over) parsed.over = false;
        if (!parsed.kibbutzYear) {
          parsed.kibbutzYear = {};
          for (const id of parsed.kibbutzim ?? []) parsed.kibbutzYear[id] = (parsed.year ?? 1948) - 5;
        }
        if (!parsed.fusion) parsed.fusion = [];
        if (!parsed.bought) parsed.bought = [];
        if ((parsed.year ?? 1948) >= 1948) next = parsed;
      }
    } catch {
      /* fresh board */
    }
    setState(next);
  }, []);

  useEffect(() => {
    if (!state) return;
    localStorage.setItem(SAVE, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (!auto || !state) return;
    const hint = suggestNext(state);
    if (hint.id != null) {
      setSelected(hint.id);
      const id = hint.id;
      requestAnimationFrame(() => {
        document.querySelector(`[data-hex="${id}"]`)?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
      });
    }
    const timer = window.setTimeout(() => {
      setState((s) => {
        if (!s) return s;
        const next = playHint(s);
        if (!next || next.over) queueMicrotask(() => setAuto(false));
        return next ?? s;
      });
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [auto, state]);

  if (!state) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 50,
          display: "grid",
          placeItems: "center",
          background: "#f3ead7",
          color: "#1c1914",
          fontFamily: "Georgia, serif",
        }}
      >
        <style>{"@keyframes boot-spin{to{transform:rotate(360deg)}}"}</style>
        <div style={{ textAlign: "center" }}>
          <div
            className="boot-spin"
            style={{
              width: "2.25rem",
              height: "2.25rem",
              margin: "0 auto 0.75rem",
              border: "3px solid #2a241c",
              borderTopColor: "#2f5f73",
              borderRadius: "999px",
              animation: "boot-spin 0.7s linear infinite",
            }}
          />
          <p style={{ fontSize: "1.35rem" }}>Loading the map</p>
        </div>
      </div>
    );
  }

  const view = present(state, selected);
  const tip = hover == null || view.brief ? null : view.cells.find((c) => c.id === hover.id) ?? null;
  const width = HEX * Math.sqrt(3) * (COLS + 0.6) + HEX;
  const height = HEX * 1.5 * (ROWS - 1) + HEX * 2.2;

  return (
    <Shell>
      <main className="relative flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-end justify-between gap-2 border-b border-[var(--color-line)]/15 px-3 py-2">
          <h1 className="text-2xl leading-none">Year {view.year}</h1>
          {!view.paper && <p className="max-w-md text-sm">{view.score}</p>}
          <p className="flex flex-wrap gap-x-3 text-xs text-[var(--color-muted)]">
            <span className="inline-flex items-center gap-1"><span className="inline-block size-3 rounded-sm" style={{ background: "#1a56c4" }} /> Bought</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block size-3 rounded-sm" style={{ background: "#178a32" }} /> Not yours</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block size-3 rounded-sm" style={{ background: FILL.desert }} /> Dirt</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block size-3 rounded-sm bg-cover" style={{ backgroundImage: "url(/tex/fertile.jpg)" }} /> Farmed</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block size-3 rounded-sm" style={{ background: FILL.orchard }} /> Orchard</span>
          </p>
          {view.paper ? (
            <p className="text-sm text-[var(--color-muted)]">No water policy. The books do not move.</p>
          ) : (
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <Stat k="Treasury" v={`${view.cash} IL`} />
            <Stat k="People" v={view.pop} />
            <Stat k="Granary" v={view.granary} />
            <Stat k="Spare flow" v={view.spare} />
            <Stat k="Policy" v={`${view.policyCash} IL · ${view.apUsed}/${view.apTotal} AP`} />
          </dl>
          )}
        </div>
        <div className="min-h-0 w-full flex-1 overflow-auto bg-[var(--color-paper)]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="block w-full"
          style={{ aspectRatio: `${width} / ${height}`, height: "auto" }}
          role="img"
          aria-label="Textured hex map of Mandate Palestine, north at top"
        >
          <defs>
            {["sea", "lake", "fertile", "swamp", "desert", "hard", "mountain", "salt", "urban", "beyond"].map((name) => (
              <pattern key={name} id={`tex-${name}`} patternUnits="userSpaceOnUse" width="64" height="64">
                <image href={`/tex/${name}.jpg`} width="64" height="64" preserveAspectRatio="xMidYMid slice" />
              </pattern>
            ))}
          </defs>
          {view.cells.map((h) => {
            const [cx, cy] = center(h.r, h.c);
            return (
              <g
                key={h.id}
                data-hex={h.id}
                onClick={() => setSelected(h.id)}
                onMouseEnter={(e) => setHover({ id: h.id, x: e.clientX, y: e.clientY })}
                onMouseMove={(e) => setHover({ id: h.id, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHover((cur) => (cur?.id === h.id ? null : cur))}
                className="cursor-pointer"
              >
                <polygon
                  points={hexPoints(cx, cy, HEX - 0.6)}
                  fill={h.fill}
                  stroke={hover?.id === h.id ? "#1c1914" : h.stroke}
                  strokeWidth={hover?.id === h.id ? 2.2 : h.strokeWidth}
                  strokeOpacity={h.strokeOpacity}
                />
                {h.tex && (
                  <polygon points={hexPoints(cx, cy, HEX - 0.6)} fill={h.tex} fillOpacity={0.28} style={{ pointerEvents: "none" }} />
                )}
                {h.deed === "yishuv" && (
                  <polygon points={hexPoints(cx, cy, HEX - 3.1)} fill="#1a56c4" fillOpacity={0.28} stroke="#1a56c4" strokeWidth={2.4} />
                )}
                {h.deed === "arab" && (
                  <polygon points={hexPoints(cx, cy, HEX - 3.1)} fill="#178a32" fillOpacity={0.28} stroke="#178a32" strokeWidth={2.4} />
                )}
                {h.piped && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={3.2}
                    fill={h.planned ? "none" : h.wet ? "#14384a" : "#1c1914"}
                    stroke={h.planned ? "#14384a" : "none"}
                    strokeWidth={h.planned ? 1.2 : 0}
                  />
                )}
                {h.flow > 0 && <circle cx={cx} cy={cy} r={3.4} fill="#f3ead7" />}
                {h.kibbutz && <circle cx={cx} cy={cy - 2} r={3.2} fill="#f3ead7" stroke="#1c1914" strokeWidth={0.8} />}
                {h.fusion && <FusionMark cx={cx} cy={cy} />}
                {h.name && (
                  <text
                    x={cx}
                    y={cy + (h.piped || h.flow ? 9 : 3)}
                    textAnchor="middle"
                    fontSize="5.5"
                    fill="#1c1914"
                    style={{ fontFamily: "var(--font-sans)" }}
                  >
                    {h.name}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <section className={`shrink-0 overflow-auto border-t border-[var(--color-line)]/15 px-3 py-2 ${view.paper ? "max-h-[52vh]" : "max-h-[42vh]"}`}>
        <p className="mb-2 max-w-3xl text-sm text-[var(--color-muted)]">{view.coach}</p>
        <Inspector
          view={view}
          onPipe={() => selected != null && setState((s) => (s ? queueAction(s, "pipe", selected) : s))}
          onIrrigate={() => selected != null && setState((s) => (s ? queueAction(s, "irrigate", selected) : s))}
          onDrain={() => selected != null && setState((s) => (s ? queueAction(s, "drain", selected) : s))}
          onKibbutz={() => selected != null && setState((s) => (s ? queueAction(s, "kibbutz", selected) : s))}
          onUpgrade={() => selected != null && setState((s) => (s ? queueAction(s, "upgrade", selected) : s))}
          onFusion={() => selected != null && setState((s) => (s ? queueAction(s, "fusion", selected) : s))}
          onClose={() => setState((s) => (s ? commitPolicy(s) : s))}
          onPaper={() => setState((s) => (s ? nextPaper(s) : s))}
          onDrop={(index) => setState((s) => (s ? dropPolicyItem(s, index) : s))}
          onUndo={() => setState((s) => (s ? undoPolicy(s) : s))}
          playing={auto}
          onHelp={(shift) => {
            if (auto) {
              setAuto(false);
              return;
            }
            if (shift) {
              setAuto(true);
              return;
            }
            const hint = view.hint;
            if (hint.id == null) return;
            setSelected(hint.id);
            requestAnimationFrame(() => {
              document.querySelector(`[data-hex="${hint.id}"]`)?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
            });
          }}
          onReset={() => {
            localStorage.removeItem(SAVE);
            setAuto(false);
            setState(campaignState());
            setSelected(null);
          }}
        />
        {!view.paper && (
        <ol className="mt-2 max-h-8 overflow-hidden text-xs text-[var(--color-muted)]">
          {view.log.map((line, i) => (
            <li key={i} className="truncate">
              {line}
            </li>
          ))}
        </ol>
        )}
      </section>
      {tip && hover && (
        <div
          className="pointer-events-none fixed z-20 w-56 rounded-[var(--radius)] border border-[var(--color-line)]/25 bg-[var(--color-paper)] px-3 py-2 text-xs shadow-lg"
          style={{
            left: Math.min(hover.x + 14, (typeof window === "undefined" ? 800 : window.innerWidth) - 240),
            top: Math.min(hover.y + 14, (typeof window === "undefined" ? 600 : window.innerHeight) - 180),
          }}
        >
          <p className="font-medium">{tip.title}</p>
          <dl className="mt-1">
            {tip.facts.map((f) => (
              <div key={f.k} className="flex justify-between gap-3 leading-5">
                <dt className="text-[var(--color-muted)]">{f.k}</dt>
                <dd className="text-right">{f.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {view.brief && (
        <div className="absolute inset-0 z-10 flex items-end justify-center bg-[var(--color-ink)]/35 p-4 sm:items-center">
          <article className="w-full max-w-lg rounded-[var(--radius)] border border-[var(--color-line)]/20 bg-[var(--color-paper)] p-4 shadow-lg">
            <p className="text-xs tracking-wide text-[var(--color-muted)]">{view.brief.kicker}</p>
            <h2 className="mt-1 text-2xl leading-tight">{view.brief.title}</h2>
            <p className="mt-2 text-sm leading-relaxed">{view.brief.body}</p>
            <button
              type="button"
              onClick={() => view.brief && setState((s) => (s ? ackBrief(s, view.brief!.id) : s))}
              className="mt-4 min-h-11 rounded-[var(--radius)] bg-[var(--color-ink)] px-4 text-sm font-medium text-[var(--color-paper)]"
            >
              Continue
            </button>
          </article>
        </div>
      )}
      </main>
    </Shell>
  );
}

function Inspector({
  view,
  onPipe,
  onIrrigate,
  onDrain,
  onClose,
  onPaper,
  onReset,
  onDrop,
  onKibbutz,
  onUpgrade,
  onFusion,
  onUndo,
  playing,
  onHelp,
}: {
  view: ReturnType<typeof present>;
  onPipe: () => void;
  onIrrigate: () => void;
  onDrain: () => void;
  onKibbutz: () => void;
  onUpgrade: () => void;
  onFusion: () => void;
  onClose: () => void;
  onPaper: () => void;
  onReset: () => void;
  onDrop: (index: number) => void;
  onUndo: () => void;
  playing: boolean;
  onHelp: (shift: boolean) => void;
}) {
  const pipe = view.actions.find((a) => a.id === "pipe");
  const irrigateAction = view.actions.find((a) => a.id === "irrigate");
  const drainAction = view.actions.find((a) => a.id === "drain");
  const kibbutz = view.actions.find((a) => a.id === "kibbutz");
  const upgrade = view.actions.find((a) => a.id === "upgrade");
  const fusion = view.actions.find((a) => a.id === "fusion");

  return (
    <div className="flex flex-col gap-2">
      {view.paper ? (
        <article className="gazette">
          <p className="mast">The Palestine Gazette</p>
          <p className="dateline">Jerusalem, {view.paper.year}</p>
          <hr className="rule" />
          <h2>{view.paper.headline}</h2>
          <p className="deck">{view.paper.deck}</p>
          <p className="copy">{view.paper.body}</p>
          <button
            type="button"
            onClick={onPaper}
            className="mt-3 min-h-11 rounded-[var(--radius)] bg-[var(--color-ink)] px-4 font-sans text-sm font-medium text-[var(--color-paper)]"
          >
            [ {view.paper.button} ]
          </button>
        </article>
      ) : (
        <>
      <h2 className="text-lg">{view.title}</h2>
      {view.blurb && <p className="text-sm text-[var(--color-muted)]">{view.blurb}</p>}
      {view.actions.length > 0 && (
        <ul className="max-w-xl text-sm">
          {view.actions.map((action) => (
            <li key={action.id}>
              <span className="font-medium">{view.best === action.id ? `(Best) ${action.label}` : action.label}. </span>
              {action.effect}
              {action.reason ? ` ${action.reason}` : ""}
            </li>
          ))}
        </ul>
      )}
      {view.best === "commit" && (
        <p className="max-w-xl text-sm">
          <span className="font-medium">(Best) {view.year < 1948 ? "Push for Independence" : "Commit policy"}. </span>
          {view.year < 1948
            ? "You own the swamp. They approved it in 1934 and did not dig it. That is the only move."
            : "Nothing left is legal, or the points are already spent."}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={(e) => onHelp(e.shiftKey)}
          title="Shift-click plays each suggested move, one second apart. Click again to stop."
          className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius)] border border-[var(--color-line)]/30 px-3 text-sm font-medium"
        >
          <CircleHelp size={16} /> {playing ? "Stop" : "Next move"}
        </button>
        {pipe && (
          <button
            type="button"
            disabled={pipe.disabled}
            onClick={onPipe}
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius)] bg-[var(--color-water)] px-3 text-sm font-medium text-[var(--color-paper)] disabled:opacity-40"
          >
            <Shovel size={16} /> {pipe.label}
          </button>
        )}
        {irrigateAction && (
          <button
            type="button"
            disabled={irrigateAction.disabled}
            onClick={onIrrigate}
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius)] px-3 text-sm font-medium text-[var(--color-paper)] disabled:opacity-40"
            style={{ background: ALLOCATED }}
          >
            <Droplets size={16} /> {irrigateAction.label}
          </button>
        )}
        {drainAction && (
          <button
            type="button"
            disabled={drainAction.disabled}
            onClick={onDrain}
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius)] px-3 text-sm font-medium text-[var(--color-paper)] disabled:opacity-40"
            style={{ background: FILL.swamp }}
          >
            {drainAction.label}
          </button>
        )}
        {kibbutz && (
          <button
            type="button"
            disabled={kibbutz.disabled}
            onClick={onKibbutz}
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius)] bg-[var(--color-copper)] px-3 text-sm font-medium text-[var(--color-paper)] disabled:opacity-40"
          >
            {kibbutz.label}
          </button>
        )}
        {upgrade && (
          <button
            type="button"
            disabled={upgrade.disabled}
            onClick={onUpgrade}
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius)] bg-[var(--color-ink)] px-3 text-sm font-medium text-[var(--color-paper)] disabled:opacity-40"
          >
            {upgrade.label}
          </button>
        )}
        {fusion && (
          <button
            type="button"
            disabled={fusion.disabled}
            onClick={onFusion}
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius)] bg-[var(--color-water)] px-3 text-sm font-medium text-[var(--color-paper)] disabled:opacity-40"
          >
            <Radiation size={16} /> {fusion.label}
          </button>
        )}
        <button
          type="button"
          disabled={view.over || view.brief != null}
          onClick={onClose}
          className="min-h-11 rounded-[var(--radius)] bg-[var(--color-ink)] px-3 text-sm font-medium text-[var(--color-paper)] disabled:opacity-40"
        >
          {view.over ? String(view.year) : view.year < 1948 ? "Push for Independence" : "Commit policy"}
        </button>
        <button
          type="button"
          disabled={view.policy.length === 0}
          onClick={onUndo}
          className="min-h-11 rounded-[var(--radius)] border border-[var(--color-line)]/20 px-3 text-sm disabled:opacity-40"
        >
          Undo
        </button>
      </div>
      <div className="text-sm">
        <p className="font-medium">
          This year's water policy · {view.policyCash} IL · {view.apUsed}/{view.apTotal} AP
        </p>
        {view.policy.length === 0 ? (
          <p className="text-xs text-[var(--color-muted)]">
            {view.year < 1948
              ? "You own the land. They approved it in 1934 and did not dig it. Push for independence. That is the only move."
              : "Nothing drafted. Treasury stays put until you commit. Undo returns the last line's action points."}
          </p>
        ) : (
          <table className="mt-1 w-full max-w-xl text-left text-xs">
            <thead className="text-[10px] tracking-wide text-[var(--color-muted)] uppercase">
              <tr>
                <th className="py-1 pr-2 font-medium">Work</th>
                <th className="py-1 pr-2 font-medium">IL</th>
                <th className="py-1 pr-2 font-medium">AP</th>
                <th className="py-1 pr-2 font-medium">Spent</th>
                <th className="py-1 pr-2 font-medium">AP left</th>
                <th className="py-1 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {view.policy.map((line) => (
                <tr key={line.index} className={line.ok ? "" : "text-[var(--color-muted)] line-through"}>
                  <td className="py-1 pr-2">{line.label}</td>
                  <td className="py-1 pr-2">{line.cash}</td>
                  <td className="py-1 pr-2">{line.ap}</td>
                  <td className="py-1 pr-2">{line.ok ? line.runningCash : "-"}</td>
                  <td className="py-1 pr-2">{line.ok ? view.apTotal - line.runningAp : "-"}</td>
                  <td className="py-1">
                    <button type="button" className="min-h-8 underline" onClick={() => onDrop(line.index)}>
                      Drop
                    </button>
                  </td>
                </tr>
              ))}
              <tr className="font-medium">
                <td className="py-1 pr-2">Treasury after commit</td>
                <td className="py-1 pr-2">{view.cash - view.policyCash}</td>
                <td className="py-1 pr-2"></td>
                <td className="py-1 pr-2">{view.policyCash}</td>
                <td className="py-1 pr-2">{view.apTotal - view.apUsed}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
        </>
      )}
      <button
        type="button"
        onClick={onReset}
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-[var(--radius)] border border-[var(--color-line)]/20 px-3 text-sm"
      >
        <RotateCcw size={16} /> Reset 1914
      </button>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string | number }) {
  return (
    <div>
      <dt className="text-[10px] tracking-wide text-[var(--color-muted)] uppercase">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
