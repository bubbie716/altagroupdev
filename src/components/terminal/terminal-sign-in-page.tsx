"use client";

import { Link } from "@tanstack/react-router";
import { AltaLogo } from "@/components/alta-logo";
import { DiscordSignInButton } from "@/components/auth/auth-gate";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useTheme } from "@/components/theme";
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

  return (
    <div className="terminal-shell relative min-h-dvh overflow-hidden">
      <TerminalSignInBackdrop />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-lg flex-col px-5 py-8 sm:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AltaLogo className="h-7 w-7" />
            <span className="text-[15px] font-medium tracking-tight text-[var(--terminal-text)]">
              Alta Terminal
            </span>
          </div>
          <button
            type="button"
            onClick={toggle}
            className="inline-flex size-9 items-center justify-center rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-surface)] text-[var(--terminal-muted)] transition-colors hover:text-[var(--terminal-text)]"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>

        <div className="flex flex-1 flex-col justify-center py-12">
          {user ? (
            <SignedInContinue
              displayName={user.minecraftUsername?.trim() || user.discordUsername}
              destination={destination}
            />
          ) : (
            <>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--terminal-muted)]">
                Brokerage
              </p>
              <h1 className="mt-3 text-[34px] font-medium tracking-tight text-[var(--terminal-text)] sm:text-[40px]">
                Invest in Newport.
              </h1>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-[var(--terminal-muted)]">
                Track the market, manage portfolios, and place orders through one focused trading
                workspace.
              </p>

              {errorMessage ? (
                <p
                  role="alert"
                  className="mt-6 rounded-md border border-[var(--terminal-red)]/40 bg-[var(--terminal-red)]/10 px-3 py-2 text-[13px] text-[var(--terminal-red)]"
                >
                  {errorMessage}
                </p>
              ) : null}

              <div className="mt-8">
                <DiscordSignInButton
                  redirectTo={destination}
                  label="Continue with Discord"
                />
              </div>

              <p className="mt-6 text-[12px] leading-relaxed text-[var(--terminal-muted)]">
                Roleplay brokerage for the Republic of Newport. Not a real securities firm. By
                continuing you agree to Alta’s platform terms.
              </p>
            </>
          )}
        </div>

        <footer className="pb-2 text-[11px] text-[var(--terminal-muted)]">
          <details className="group">
            <summary className="cursor-pointer list-none text-[var(--terminal-muted)] hover:text-[var(--terminal-text)]">
              Legal & disclosures
              <span className="ml-1 opacity-60 group-open:hidden">+</span>
              <span className="ml-1 hidden opacity-60 group-open:inline">−</span>
            </summary>
            <div className="mt-2 space-y-2 leading-relaxed">
              <p>
                Alta Terminal is a fictional brokerage product operated for roleplay within the Alta
                ecosystem. Market data shown in demonstration mode is synthetic and not live.
              </p>
              <p>
                Orders placed against unavailable or demonstration data sources do not settle in a
                live TSE.
              </p>
            </div>
          </details>
        </footer>
      </div>
    </div>
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
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--terminal-muted)]">
        Already signed in
      </p>
      <h1 className="mt-3 text-[28px] font-medium tracking-tight text-[var(--terminal-text)]">
        Welcome back, {displayName}.
      </h1>
      <p className="mt-3 text-[14px] text-[var(--terminal-muted)]">
        Continue to your Terminal workspace.
      </p>
      <Link
        to={destination}
        className={cn(
          "mt-8 inline-flex items-center justify-center rounded-md px-5 py-2.5 text-[13px] font-medium",
          "bg-[var(--terminal-green)] text-black transition-opacity hover:opacity-95",
        )}
      >
        Continue to Terminal
      </Link>
    </div>
  );
}

function TerminalSignInBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div
        className="absolute inset-0 opacity-[0.45]"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 70% 20%, color-mix(in oklch, var(--terminal-green) 14%, transparent), transparent 55%), radial-gradient(ellipse 60% 40% at 10% 90%, color-mix(in oklch, var(--terminal-border) 80%, transparent), transparent 50%)",
        }}
      />
      <svg
        className="absolute bottom-0 right-0 h-[55%] w-[90%] max-w-3xl translate-x-[8%] translate-y-[6%] opacity-[0.22] sm:opacity-[0.28]"
        viewBox="0 0 640 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0 210 L40 198 L80 205 L120 170 L160 178 L200 140 L240 148 L280 110 L320 125 L360 95 L400 108 L440 72 L480 88 L520 55 L560 70 L600 40 L640 48 L640 280 L0 280 Z"
          fill="color-mix(in oklch, var(--terminal-green) 22%, transparent)"
        />
        <path
          d="M0 210 L40 198 L80 205 L120 170 L160 178 L200 140 L240 148 L280 110 L320 125 L360 95 L400 108 L440 72 L480 88 L520 55 L560 70 L600 40 L640 48"
          stroke="var(--terminal-green)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {[40, 120, 200, 280, 360, 440, 520, 600].map((x, i) => (
          <circle
            key={x}
            cx={x}
            cy={[198, 170, 140, 110, 95, 72, 55, 40][i]}
            r="2.5"
            fill="var(--terminal-green)"
          />
        ))}
      </svg>
      <div
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--terminal-border) 1px, transparent 1px), linear-gradient(to bottom, var(--terminal-border) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
    </div>
  );
}
