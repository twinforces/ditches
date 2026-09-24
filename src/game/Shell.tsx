import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh min-h-0 flex-col">
      <header className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[var(--color-line)]/15 px-3 py-2 md:px-4">
        <div>
          <Link to="/" className="display text-xl leading-none">
            Ditches and Desert
          </Link>
          <p className="text-sm text-[var(--color-muted)]">
            A{" "}
            <a href="https://x.com/GrumpyTechBro" className="underline">
              GrumpyTechBro
            </a>{" "}
            joint
          </p>
        </div>
        <nav className="flex gap-4 text-sm">
          <Link to="/" className="underline">
            Play
          </Link>
          <Link to="/land" className="underline">
            Land
          </Link>
          <Link to="/note" className="underline">
            Author's Note
          </Link>
          <Link to="/receipts" className="underline">
            Receipts
          </Link>
        </nav>
      </header>
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">{children}</div>
    </div>
  );
}
