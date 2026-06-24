import { Link, useRouterState } from "@tanstack/react-router";
import { AltaWordmark } from "./alta-logo";
import { AuthUserMenu } from "@/components/auth/user-menu";
import { cn } from "@/lib/utils";
import { type } from "@/lib/typography";
import { useTheme } from "./theme";
import { Sun, Moon } from "lucide-react";

const links = [
  { to: "/", label: "Home", exact: true },
  { to: "/bank", label: "Alta Bank", match: "/bank" },
  { to: "/exchange", label: "Alta Exchange", match: "/exchange" },
  { to: "/governance", label: "About", match: "/governance" },
] as const;

function isNavLinkActive(
  pathname: string,
  link: (typeof links)[number],
): boolean {
  if ("exact" in link && link.exact) return pathname === link.to;
  if ("match" in link) return pathname.startsWith(link.match);
  return pathname.startsWith(link.to);
}

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
            const active = isNavLinkActive(pathname, l);
            return (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  "type-nav relative rounded-md px-3 py-1.5 text-muted-foreground transition-colors duration-200 hover:text-foreground",
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
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="rounded-md border border-border bg-surface-2/60 p-2 text-muted-foreground transition-colors hover:text-foreground hover:border-border-strong"
          >
            {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          </button>
          <AuthUserMenu />
        </div>
      </div>
    </header>
  );
}

type FooterLink = { label: string; to: string };

const footerColumns: { title: string; items: FooterLink[] }[] = [
  {
    title: "Divisions",
    items: [
      { label: "Alta Bank", to: "/bank" },
      { label: "Alta Exchange", to: "/exchange" },
      { label: "NCC", to: "/governance" },
    ],
  },
  {
    title: "Platform",
    items: [
      { label: "Alta Terminal", to: "/terminal" },
      { label: "Market Data", to: "/exchange" },
      { label: "Research", to: "/exchange/research" },
      { label: "API", to: "/exchange/api" },
    ],
  },
  {
    title: "Company",
    items: [
      { label: "About", to: "/governance" },
      { label: "Leadership", to: "/governance/leadership" },
      { label: "Governance Documents", to: "/governance/documents" },
      { label: "Press", to: "/governance" },
      { label: "Careers", to: "/governance" },
    ],
  },
];

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
          {footerColumns.map((c) => (
            <div key={c.title}>
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {c.title}
              </div>
              <ul className="mt-4 space-y-2 text-sm text-foreground/90">
                {c.items.map((item) => (
                  <li key={item.label}>
                    <Link to={item.to} className="transition-colors hover:text-gold">
                      {item.label}
                    </Link>
                  </li>
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
            Alta platform data reflects live platform records where available. Market data remains simulated.
          </p>
        </div>
      </div>
    </footer>
  );
}
