import type { ReactNode } from "react";
import { Card } from "@/components/page-shell";
import { SiteNav } from "@/components/site-nav";
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

function LoginPortalBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0 opacity-[0.28] dark:opacity-[0.18]"
        style={{
          backgroundImage: `
            linear-gradient(to right, color-mix(in oklch, var(--border) 70%, transparent) 1px, transparent 1px),
            linear-gradient(to bottom, color-mix(in oklch, var(--border) 70%, transparent) 1px, transparent 1px)
          `,
          backgroundSize: "56px 56px",
        }}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/25 to-transparent" />
      <div className="absolute -top-32 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-gold/[0.04] blur-3xl" />
      <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-[#1e3a5f]/[0.06] blur-3xl dark:bg-[#1e3a5f]/[0.12]" />
      <div className="absolute -bottom-32 -left-32 h-72 w-72 rounded-full bg-gold/[0.03] blur-3xl" />
    </div>
  );
}

export function LoginPortalShell({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <LoginPortalBackground />
      <SiteNav />
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-10">
        {children}
      </main>
      {footer}
    </div>
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
    <div className="flex w-full max-w-md flex-col items-center text-center">
      <header className="mb-8 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-gold">Alta Group</p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
          Sign in to Alta
        </h1>
        <p className="mx-auto max-w-sm text-[14px] leading-relaxed text-muted-foreground">
          Access your accounts, portfolios, and platform features.
        </p>
      </header>

      <div className="w-full">
        {errorMessage && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-left text-sm text-destructive">
            {errorMessage}
          </div>
        )}

        <Card className="border-border/80 bg-card/95 !p-8 shadow-sm backdrop-blur-sm">
          <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-full border border-border bg-surface-2/60">
            <ShieldCheck className="size-[18px] text-foreground" strokeWidth={1.75} />
          </div>
          <h2 className="text-lg font-semibold tracking-tight">Alta Platform Access</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Access to this area requires an Alta account.
          </p>
          <div className="mt-7">
            <DiscordSignInButton redirectTo={target} />
          </div>
        </Card>
      </div>
    </div>
  );
}

export function LoginPortalFooter() {
  return (
    <footer className="relative z-10 pb-8 pt-2 text-center">
      <p className="type-meta/80">
        Individual accounts · Authorized company representatives
      </p>
    </footer>
  );
}
