import { Link, useRouterState } from "@tanstack/react-router";
import { AltaWordmark } from "./alta-logo";
import { cn } from "@/lib/utils";
import { useTheme } from "./theme";
import { Sun, Moon } from "lucide-react";

const links = [
  { to: "/", label: "Overview" },
  { to: "/bank/dashboard", label: "Alta Bank", match: "/bank" },
  { to: "/terminal", label: "Alta Terminal" },
  { to: "/exchange", label: "Alta Exchange" },
  { to: "/governance", label: "About" },
] as const;

export function SiteNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { theme, toggle } = useTheme();
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6">
        <Link to="/" className="flex items-center">
          <AltaWordmark />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => {
            const active =
              l.to === "/"
                ? pathname === "/"
                : "match" in l
                  ? pathname.startsWith(l.match)
                  : pathname.startsWith(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  "relative rounded-md px-3 py-1.5 text-[13px] tracking-wide text-muted-foreground transition-colors duration-200 hover:text-foreground",
                  active &&
                    "text-foreground after:absolute after:inset-x-2.5 after:-bottom-[17px] after:h-[2px] after:rounded-full after:bg-gold",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground lg:inline-flex">
            <span className="inline-block size-1.5 rounded-full bg-[var(--success)] shadow-[0_0_8px_var(--success)]" />
            Alta Exchange • Open
          </span>
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="rounded-md border border-border bg-surface-2/60 p-2 text-muted-foreground transition-colors hover:text-foreground hover:border-border-strong"
          >
            {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          </button>
          <Link
            to="/terminal"
            className="rounded-md border border-border-strong bg-surface-2 px-3.5 py-1.5 text-[12px] font-medium tracking-wide text-foreground transition-colors hover:bg-[color:var(--surface-2)]/70"
          >
            Enter Platform
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 mt-32">
      <div className="mx-auto max-w-[1400px] px-6 py-16">
        <div className="grid gap-12 md:grid-cols-4">
          <div className="md:col-span-1">
            <AltaWordmark />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              Live Like the 1%
            </p>
          </div>
          {[
            { title: "Divisions", items: ["Alta Bank", "Alta Terminal", "Alta Exchange", "NCC"] },
            { title: "Platform", items: ["Alta Terminal", "Alta Exchange", "Research", "API"] },
          { title: "Company", items: ["About", "Governance", "Press", "Careers"] },
          ].map((c) => (
            <div key={c.title}>
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {c.title}
              </div>
              <ul className="mt-4 space-y-2 text-sm text-foreground/90">
                {c.items.map((i) => (
                  <li key={i} className="hover:text-gold transition-colors cursor-default">{i}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-16 flex flex-col items-start justify-between gap-3 border-t border-border/60 pt-6 md:flex-row md:items-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            © 2026 Alta Group N.V. — Newport, ND · Florin-denominated · Settlement T+0
          </p>
          <p className="text-[11px] text-muted-foreground">
            Simulated Newport financial infrastructure.
          </p>
        </div>
      </div>
    </footer>
  );
}
