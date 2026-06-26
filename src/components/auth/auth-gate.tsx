import type { ReactNode } from "react";
import { SiteNav } from "@/components/site-nav";
import { LegalMicroFooter } from "@/components/footers";
import { cn } from "@/lib/utils";
import { ShieldCheck } from "lucide-react";

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

export function DiscordSignInButton({
  redirectTo = "/",
  className,
  label = "Sign in with Discord",
}: {
  redirectTo?: string;
  className?: string;
  label?: string;
}) {
  const href = `/api/auth/discord?redirect=${encodeURIComponent(redirectTo)}`;

  return (
    <a
      href={href}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2.5 rounded-md border border-[#4752C4]/30 bg-[#5865F2] px-5 py-2.5 text-[13px] font-medium text-white shadow-sm transition-[opacity,box-shadow] hover:opacity-95 hover:shadow-md",
        className,
      )}
    >
      <DiscordIcon className="size-4 shrink-0" />
      {label}
    </a>
  );
}

function LoginBrandPanel({ brandEyebrow }: { brandEyebrow: string }) {
  return (
    <aside className="relative hidden w-[46%] shrink-0 flex-col justify-between overflow-hidden border-r border-border bg-surface-2/40 px-10 py-12 lg:flex xl:w-[50%] xl:px-16">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `linear-gradient(to right, color-mix(in oklch, var(--border) 70%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklch, var(--border) 70%, transparent) 1px, transparent 1px)`,
          backgroundSize: "56px 56px",
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute -top-32 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-gold/[0.05] blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-gold/40 to-transparent" aria-hidden />

      <div className="relative">
        <div className="font-mono text-[10px] uppercase tracking-[0.28em] text-gold">
          {brandEyebrow}
        </div>
      </div>

      <div className="relative max-w-[34rem]">
        <h1 className="font-serif text-4xl leading-[1.04] tracking-tight sm:text-5xl xl:text-[3.5rem]">
          The financial infrastructure of Newport, built for individuals, businesses, and institutions.
        </h1>
        <p className="mt-6 font-serif text-lg leading-relaxed tracking-tight text-muted-foreground">
          Alta Bank, Alta Exchange, and Newport Clearing Corporation —
          one integrated financial platform for the Republic.
        </p>
      </div>

      <div className="relative flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        <span>Banking</span>
        <span>Capital Markets</span>
        <span>Financial Infrastructure</span>
      </div>
    </aside>
  );
}

function LoginEditorialLayout({
  children,
  footer,
  brandEyebrow,
}: {
  children: ReactNode;
  footer?: ReactNode;
  brandEyebrow: string;
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <SiteNav />
      <main className="relative z-10 flex flex-1">
        <LoginBrandPanel brandEyebrow={brandEyebrow} />
        <section className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
          {children}
        </section>
      </main>
      {footer}
    </div>
  );
}

export function LoginPortalShell({
  children,
  footer,
  brandEyebrow = "Alta Group · Member Access",
}: {
  children: ReactNode;
  footer?: ReactNode;
  brandEyebrow?: string;
}) {
  return (
    <LoginEditorialLayout footer={footer} brandEyebrow={brandEyebrow}>
      {children}
    </LoginEditorialLayout>
  );
}

export function AuthGate({
  redirectTo,
  errorMessage,
}: {
  redirectTo?: string;
  errorMessage?: string;
}) {
  const target = redirectTo ?? "/";

  return (
    <div className="flex w-full max-w-md flex-col">
      <header className="space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-gold">
          Member sign-in
        </p>
        <h2 className="font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
          Sign in to Alta
        </h2>
        <p className="max-w-sm text-[14px] leading-relaxed text-muted-foreground">
          Authentication is provided through your Discord account. Alta does not maintain a separate password.
        </p>
      </header>

      {errorMessage && (
        <div className="mt-6 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-left text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      <div className="mt-8 rounded-lg border border-border bg-surface-1 p-7">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-md border border-border bg-surface-2/60">
            <ShieldCheck className="size-[16px] text-foreground" strokeWidth={1.5} />
          </div>
          <div>
            <div className="font-serif text-base leading-tight">Alta Platform Access</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Single sign-on · Discord OAuth
            </div>
          </div>
        </div>

        <div className="mt-6">
          <DiscordSignInButton redirectTo={target} />
        </div>

        <div className="mt-6 border-t border-border/70 pt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Individual accounts · Authorized company representatives
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use LegalMicroFooter from @/components/footers */
export function LoginPortalFooter() {
  return <LegalMicroFooter context="login" />;
}
