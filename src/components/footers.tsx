import { Link } from "@tanstack/react-router";
import { AltaWordmark } from "./alta-logo";
import type { LegalFooterContext, PlatformFooterContext } from "@/lib/platform/footer-variant";

const columnTitleClass =
  "font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground";

const platformOptionalLinks = [
  { label: "About", to: "/governance" },
  { label: "Leadership", to: "/governance/leadership" },
] as const;

export function PublicFooter() {
  return (
    <footer className="mt-32 border-t border-border/60">
      <div className="mx-auto max-w-[1400px] px-6 py-16">
        <div className="grid gap-12 md:grid-cols-3">
          <div>
            <AltaWordmark />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">Live Like the 1%</p>
          </div>

          <div>
            <div className={columnTitleClass}>Divisions</div>
            <ul className="mt-4 space-y-2 text-sm text-foreground/90">
              <li>
                <Link to="/bank" className="transition-colors hover:text-gold">
                  Alta Bank
                </Link>
              </li>
              <li>
                <Link to="/exchange" className="transition-colors hover:text-gold">
                  Alta Exchange
                </Link>
              </li>
              <li className="text-muted-foreground">NCC — In Development</li>
            </ul>
          </div>

          <div>
            <div className={columnTitleClass}>Company</div>
            <ul className="mt-4 space-y-2 text-sm text-foreground/90">
              <li>
                <Link to="/governance" className="transition-colors hover:text-gold">
                  About
                </Link>
              </li>
              <li>
                <Link to="/governance/leadership" className="transition-colors hover:text-gold">
                  Leadership
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-3 border-t border-border/60 pt-6 md:flex-row md:items-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            © 2026 Alta Group N.V. · Newport · Florin-denominated
          </p>
          <p className="max-w-xl text-[11px] text-muted-foreground">
            Alta Bank and Alta Exchange operate under Alta Group N.V. Newport Clearing Corporation
            is in development. Market data may be simulated.
          </p>
        </div>
      </div>
    </footer>
  );
}

/** @deprecated Use PublicFooter */
export const SiteFooter = PublicFooter;

const platformCopy: Record<
  PlatformFooterContext,
  { primary: string; secondary: string }
> = {
  bank: {
    primary: "© 2026 Alta Group N.V. · Alta Bank",
    secondary: "Deposits, transfers, and account records reflect live platform data.",
  },
  exchange: {
    primary: "© 2026 Alta Group N.V. · Alta Exchange",
    secondary:
      "Alta Terminal is an Alta Exchange product. Market data may be simulated.",
  },
  general: {
    primary: "© 2026 Alta Group N.V.",
    secondary: "Platform records reflect live data where available.",
  },
};

export function PlatformFooter({ context = "general" }: { context?: PlatformFooterContext }) {
  const copy = platformCopy[context];

  return (
    <footer className="mt-12 border-t border-border/60">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-5 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {copy.primary}
          </p>
          <p className="text-[11px] text-muted-foreground">{copy.secondary}</p>
        </div>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {platformOptionalLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-gold"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}

const legalCopy: Record<
  LegalFooterContext,
  { primary: string; secondary: string }
> = {
  login: {
    primary: "© 2026 Alta Group N.V. · Member Access",
    secondary: "Sign in with Discord · Individual accounts and authorized company representatives",
  },
  maintenance: {
    primary: "© 2026 Alta Group N.V. · Platform Maintenance",
    secondary: "Scheduled work in progress. Access will resume when maintenance ends.",
  },
  "access-restricted": {
    primary: "© 2026 Alta Group N.V. · Member Access",
    secondary: "Sign in with Discord · Individual accounts and authorized company representatives",
  },
};

export function LegalMicroFooter({ context = "login" }: { context?: LegalFooterContext }) {
  const copy = legalCopy[context];

  return (
    <footer className="relative z-10 border-t border-border/60 px-6 py-5 sm:px-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {copy.primary}
        </span>
        <span className="text-[11px] text-muted-foreground">{copy.secondary}</span>
      </div>
    </footer>
  );
}
