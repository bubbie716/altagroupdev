import { cn } from "@/lib/utils";
import { AltaWordmark } from "@/components/alta-logo";
import { Link } from "@tanstack/react-router";
import { LEGAL_CENTER_PATH } from "@/lib/site/site-links";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { useEffect, type ReactNode } from "react";

export type OnboardingShellProps = {
  title: string;
  description?: string;
  progressLabel: string;
  progressCurrent: number;
  progressTotal: number;
  children: ReactNode;
  footer: ReactNode;
  statusMessage?: string | null;
  errorMessage?: string | null;
  className?: string;
};

export function OnboardingShell({
  title,
  description,
  progressLabel,
  progressCurrent,
  progressTotal,
  children,
  footer,
  statusMessage,
  errorMessage,
  className,
}: OnboardingShellProps) {
  const progressPct = Math.round((progressCurrent / Math.max(progressTotal, 1)) * 100);

  // Prevent the root marketing chrome from creating page-level scroll behind the pinned shell.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
    };
  }, []);

  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 flex flex-col overflow-hidden",
        "top-[var(--ui-lab-banner-height,0px)]",
        "bg-[radial-gradient(120%_80%_at_50%_-10%,rgba(196,162,90,0.14),transparent_55%),linear-gradient(180deg,#0c0d10_0%,#12141a_48%,#0e1014_100%)] text-foreground",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <header className="relative z-10 flex shrink-0 items-center justify-between px-5 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-8">
        <AltaWordmark suffix="GROUP" className="tracking-[0.2em] text-white [&_span]:text-white" />
        <nav className="flex items-center gap-4 text-[12px] text-white/60">
          <Link
            to={LEGAL_CENTER_PATH}
            className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-md px-2 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]/60"
          >
            Legal
          </Link>
          <Link
            to="/support"
            className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-md px-2 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]/60"
          >
            Help
          </Link>
          <SignOutButton className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-md px-2 text-[12px] text-white/60 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]/60">
            Log out
          </SignOutButton>
        </nav>
      </header>

      <main className="relative z-10 mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col overflow-y-auto overscroll-contain px-5 pb-3 pt-4 sm:px-8">
        <div
          className="mb-5 shrink-0"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={progressTotal}
          aria-valuenow={progressCurrent}
          aria-label={progressLabel}
        >
          <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-white/45">
            <span>{progressLabel}</span>
            <span className="tabular-nums">
              {progressCurrent}/{progressTotal}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-[var(--gold)] transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <h1 className="shrink-0 font-[family-name:Fraunces,serif] text-[clamp(1.5rem,4.5vw,2.1rem)] font-medium leading-[1.15] tracking-[-0.02em] text-white">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-prose shrink-0 text-[14px] leading-relaxed text-white/65 sm:text-[15px]">
              {description}
            </p>
          ) : null}

          <div className="mt-5 min-h-0">{children}</div>

          <div
            className="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {statusMessage || errorMessage || ""}
          </div>

          {errorMessage ? (
            <p
              className="mt-3 shrink-0 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}
        </div>
      </main>

      <footer className="relative z-20 shrink-0 border-t border-white/10 bg-[#0c0d10]/92 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md sm:px-8">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-3">{footer}</div>
      </footer>
    </div>
  );
}

export function OnboardingCheckbox({
  id,
  checked,
  onChange,
  children,
  disabled,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-3 transition-colors",
        "hover:border-white/20 focus-within:border-[var(--gold)]/50 focus-within:ring-2 focus-within:ring-[var(--gold)]/30",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 rounded border-white/30 bg-transparent text-[var(--gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]/60"
      />
      <span className="text-[13px] leading-snug text-white/90 sm:text-[14px] sm:leading-relaxed">
        {children}
      </span>
    </label>
  );
}

export function OnboardingPrimaryButton({
  children,
  disabled,
  loading,
  type = "button",
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-12 w-full items-center justify-center rounded-md bg-[var(--gold)] px-4 text-[15px] font-semibold text-[#1a1408]",
        "transition-[transform,opacity,background-color] duration-200",
        "hover:bg-[color-mix(in_oklab,var(--gold)_92%,white)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0d10]",
        "disabled:cursor-not-allowed disabled:opacity-45",
        "motion-safe:active:scale-[0.99] motion-reduce:transition-none",
      )}
    >
      {loading ? "Working…" : children}
    </button>
  );
}

export function OnboardingLegalLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded-sm font-medium text-[var(--gold)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]/60"
    >
      {children}
    </a>
  );
}
