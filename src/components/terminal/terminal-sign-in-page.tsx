"use client";

import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { AltaLogo } from "@/components/alta-logo";
import { DiscordSignInButton } from "@/components/auth/auth-gate";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  TERMINAL_POINTER_GLOW_DEFAULT,
  useTerminalPointerGlow,
} from "@/hooks/use-terminal-pointer-glow";
import { useTheme } from "@/components/theme";
import { formatAltaUserDisplayName } from "@/lib/auth/user-display";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const ERROR_MESSAGES: Record<string, string> = {
  oauth_denied: "Discord authorization was cancelled.",
  invalid_state: "Login session expired. Please try again.",
  token_exchange_failed: "Could not complete Discord sign-in.",
  oauth_callback_mismatch:
    "Sign-in completed on the wrong domain. Ensure the OAuth callback is configured in production.",
  profile_fetch_failed: "Could not load your Discord profile.",
  oauth_not_configured: "Discord OAuth is not configured on this environment.",
  database_not_configured: "Database is not configured (DATABASE_URL).",
  session_not_configured: "Session signing is not configured (SESSION_SECRET).",
  session_failed: "Could not create a login session.",
};

/** Smooth decorative market line — no labels, values, or claims. */
const MARKET_LINE_PATH =
  "M-40 268 C 80 252, 140 220, 220 228 C 310 238, 360 168, 450 176 C 540 184, 600 128, 700 138 C 820 150, 900 96, 1020 108 C 1120 118, 1200 72, 1320 84 C 1400 92, 1480 58, 1560 70";

const MARKET_AREA_PATH = `${MARKET_LINE_PATH} L1560 420 L-40 420 Z`;

/** Terminal-only sign-in — Discord OAuth with brokerage aesthetic. */
export function TerminalSignInPage({
  redirectTo = "/terminal",
  error,
}: {
  redirectTo?: string;
  error?: string;
}) {
  const user = useCurrentUser();
  const { theme, toggle } = useTheme();
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;
  const destination = redirectTo.startsWith("/") ? redirectTo : "/terminal";
  const rootRef = useRef<HTMLDivElement>(null);
  useTerminalPointerGlow(rootRef);

  const displayName = user ? formatAltaUserDisplayName(user) || null : null;

  return (
    <div
      ref={rootRef}
      className="terminal-shell terminal-entrance relative min-h-dvh overflow-x-hidden"
      style={{
        ["--terminal-pointer-x" as string]: TERMINAL_POINTER_GLOW_DEFAULT.x,
        ["--terminal-pointer-y" as string]: TERMINAL_POINTER_GLOW_DEFAULT.y,
      }}
    >
      <TerminalSignInBackdrop />

      <div className="terminal-entrance-frame relative z-10 flex min-h-dvh flex-col">
        <header className="flex h-14 w-full items-center justify-between gap-3 sm:h-16">
          <div className="flex items-center gap-2.5">
            <AltaLogo className="h-7 w-7" />
            <span className="text-[13px] font-medium tracking-tight text-[var(--terminal-text)] sm:text-[14px]">
              Alta Terminal
            </span>
          </div>
          <button
            type="button"
            onClick={toggle}
            className="inline-flex size-11 items-center justify-center rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-surface)] text-[var(--terminal-muted)] transition-colors hover:text-[var(--terminal-text)]"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </header>

        <main className="flex flex-1 flex-col justify-center py-6 sm:py-10 lg:py-14">
          <div className="terminal-entrance-hero">
            {user && displayName ? (
              <SignedInContinue displayName={displayName} destination={destination} />
            ) : (
              <SignedOutHero
                destination={destination}
                errorMessage={errorMessage}
              />
            )}
          </div>
        </main>

        <footer className="pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
          <TerminalLegalDisclosures />
        </footer>
      </div>
    </div>
  );
}

function SignedOutHero({
  destination,
  errorMessage,
}: {
  destination: string;
  errorMessage?: string;
}) {
  return (
    <>
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--terminal-muted)]">
        TERMINAL ACCESS
      </p>
      <h1 className="mt-3 text-[2.125rem] font-medium leading-[1.08] tracking-tight text-[var(--terminal-text)] sm:text-[2.75rem] lg:text-[3.25rem]">
        Invest in Newport.
      </h1>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--terminal-muted)] sm:text-[16px]">
        A focused brokerage workspace for markets, portfolios, and orders.
      </p>

      {errorMessage ? (
        <p
          role="alert"
          className="mt-6 rounded-md border border-[var(--terminal-red)]/40 bg-[var(--terminal-red)]/10 px-3 py-2 text-[13px] text-[var(--terminal-red)]"
        >
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-8 w-full max-w-sm">
        <DiscordSignInButton
          redirectTo={destination}
          label="Continue with Discord"
          className="terminal-entrance-cta min-h-11"
        />
      </div>

      <p className="mt-5 max-w-md text-[12px] leading-relaxed text-[var(--terminal-muted)]">
        Roleplay brokerage for the Republic of Newport. Not a real securities firm. By
        continuing you agree to Alta’s platform terms.
      </p>

      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--terminal-muted)]/80">
        Session ready · TSE offline
      </p>
    </>
  );
}

function SignedInContinue({
  displayName,
  destination,
}: {
  displayName: string;
  destination: string;
}) {
  return (
    <>
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--terminal-muted)]">
        TERMINAL ACCESS
      </p>
      <h1 className="mt-3 text-[2.125rem] font-medium leading-[1.08] tracking-tight text-[var(--terminal-text)] sm:text-[2.75rem] lg:text-[3.25rem]">
        Welcome back, {displayName}.
      </h1>
      <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--terminal-muted)] sm:text-[16px]">
        Continue to your Terminal workspace.
      </p>
      <Link
        to={destination}
        className={cn(
          "terminal-entrance-cta mt-8 inline-flex min-h-11 w-full max-w-sm items-center justify-center rounded-md px-5 py-2.5 text-[14px] font-medium",
          "bg-[var(--terminal-green)] text-black transition-opacity hover:opacity-95",
        )}
      >
        Continue to Terminal
      </Link>
      <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--terminal-muted)]/80">
        Authenticated session · TSE offline
      </p>
    </>
  );
}

function TerminalLegalDisclosures() {
  return (
    <details className="terminal-entrance-disclosures group relative max-w-xl">
      <summary className="flex min-h-11 cursor-pointer list-none items-center text-[12px] text-[var(--terminal-muted)] hover:text-[var(--terminal-text)] focus-visible:outline-none">
        Legal & disclosures
        <span className="ml-1.5 opacity-60 group-open:hidden" aria-hidden>
          +
        </span>
        <span className="ml-1.5 hidden opacity-60 group-open:inline" aria-hidden>
          −
        </span>
      </summary>
      <div className="terminal-entrance-disclosures-panel mt-2 space-y-2 overflow-y-auto text-[12px] leading-relaxed text-[var(--terminal-muted)]">
        <p>
          Alta Terminal is a fictional brokerage product operated for roleplay within the Alta
          ecosystem.
        </p>
        <p>
          Market quotes and order submission remain unavailable until a live Newport TSE
          connection is configured.
        </p>
      </div>
    </details>
  );
}

function TerminalSignInBackdrop() {
  return (
    <div className="terminal-entrance-backdrop pointer-events-none absolute inset-0" aria-hidden>
      <div className="terminal-entrance-ambient absolute inset-0" />
      <div className="terminal-entrance-pointer-glow absolute inset-0" />
      <div className="terminal-entrance-grid absolute inset-0" />

      <svg
        className="terminal-entrance-graph absolute inset-x-0 bottom-0 h-[48%] w-[118%] max-w-none -translate-x-[6%] sm:h-[52%] sm:w-[112%] sm:-translate-x-[4%] lg:h-[56%]"
        viewBox="0 0 1480 420"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="terminal-entrance-fill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--terminal-green)"
              stopOpacity="0.28"
            />
            <stop
              offset="45%"
              stopColor="var(--terminal-green)"
              stopOpacity="0.1"
            />
            <stop offset="100%" stopColor="var(--terminal-bg)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="terminal-entrance-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--terminal-green)" stopOpacity="0.15" />
            <stop offset="10%" stopColor="var(--terminal-green)" stopOpacity="0.75" />
            <stop offset="90%" stopColor="var(--terminal-green)" stopOpacity="0.85" />
            <stop offset="100%" stopColor="var(--terminal-green)" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <path d={MARKET_AREA_PATH} fill="url(#terminal-entrance-fill)" />
        <path
          className="terminal-entrance-graph-line"
          d={MARKET_LINE_PATH}
          stroke="url(#terminal-entrance-stroke)"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      <div className="terminal-entrance-graph-fade absolute inset-x-0 bottom-0 h-[55%]" />
    </div>
  );
}
