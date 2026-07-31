"use client";

import { useEffect, useId, useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Link } from "@tanstack/react-router";
import { OVERLAY_SCRIM_CLASS } from "@/lib/ui/overlay-layers";
import { cn } from "@/lib/utils";

function ProductConsentSafeExitLinks({
  safeExitHref,
  safeExitLabel,
}: {
  safeExitHref: string;
  safeExitLabel: string;
}) {
  if (safeExitHref === "#") {
    return (
      <div className="flex justify-center text-[12px] text-muted-foreground">
        <span>Complete consent to continue, or close the funding form.</span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[12px] text-muted-foreground">
      <Link to={safeExitHref} className="underline-offset-2 hover:underline">
        {safeExitLabel}
      </Link>
      <a href="/legal" className="underline-offset-2 hover:underline">
        Legal
      </a>
      <a href="/support" className="underline-offset-2 hover:underline">
        Support
      </a>
      <a href="/api/auth/logout" className="underline-offset-2 hover:underline">
        Log out
      </a>
    </div>
  );
}

type Presentation = {
  scope: string;
  title: string;
  headline: string;
  explanation: string;
  virtualEconomyDisclaimer: string;
  isUpdate: boolean;
  companyName: string | null;
  controlGroups: Array<{
    id: string;
    kind: string;
    documentIds: string[];
    label: string;
  }>;
  documents: Array<{
    documentId: string;
    title: string;
    version: string;
    publicPath: string;
    acceptanceType: string;
    changed: boolean;
    previousVersion: string | null;
  }>;
  sequence: { index: number; total: number } | null;
};

/**
 * Minecraft-style blocking product consent interstitial.
 * Backdrop and Escape cannot dismiss; safe exit links are always available.
 */
export function ProductConsentDialog({
  open,
  theme,
  presentation,
  checked,
  onToggle,
  onSubmit,
  submitting,
  success,
  error,
  allChecked,
  safeExitHref,
  safeExitLabel,
}: {
  open: boolean;
  theme: "bank" | "terminal";
  presentation: Presentation;
  checked: Record<string, boolean>;
  onToggle: (id: string, value: boolean) => void;
  onSubmit: () => void;
  submitting: boolean;
  success: boolean;
  error: string | null;
  allChecked: boolean;
  safeExitHref: string;
  safeExitLabel: string;
}) {
  const titleId = useId();
  const descId = useId();
  const statusId = useId();
  const firstCheckboxRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => firstCheckboxRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [open, presentation.scope]);

  const isTerminal = theme === "terminal";

  return (
    <DialogPrimitive.Root open={open} modal>
      <DialogPrimitive.Portal>
        <div
          aria-hidden
          className={cn(
            "fixed inset-0 z-[140]",
            OVERLAY_SCRIM_CLASS,
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
          )}
          // Non-dismissible: no onClick close
        />
        <DialogPrimitive.Content
          aria-labelledby={titleId}
          aria-describedby={descId}
          onEscapeKeyDown={(event) => {
            event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            event.preventDefault();
          }}
          onInteractOutside={(event) => {
            event.preventDefault();
          }}
          className={cn(
            "fixed z-[150] flex flex-col outline-none",
            // Mobile: full-height sheet
            "inset-x-0 bottom-0 max-h-[100dvh] rounded-t-2xl",
            "pb-[max(1rem,env(safe-area-inset-bottom))] pt-3",
            // Desktop: centered dialog
            "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[min(100%-2rem,28rem)]",
            "sm:max-h-[min(90dvh,40rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:pt-5",
            isTerminal
              ? "border border-emerald-500/25 bg-[#0a0f0c] text-emerald-50 shadow-[0_0_40px_rgba(16,185,129,0.08)]"
              : "border border-border bg-surface-1 text-foreground shadow-xl",
            "motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0",
            "motion-safe:sm:data-[state=open]:zoom-in-95",
            "motion-reduce:transition-none",
          )}
        >
          <div
            className={cn(
              "mx-auto mb-2 h-1 w-10 rounded-full sm:hidden",
              isTerminal ? "bg-emerald-500/40" : "bg-muted-foreground/30",
            )}
            aria-hidden
          />

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 sm:px-6">
            <header className="shrink-0 space-y-2 pb-3">
              {presentation.sequence && presentation.sequence.total > 1 ? (
                <p
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-[0.16em]",
                    isTerminal ? "text-emerald-400/80" : "text-muted-foreground",
                  )}
                >
                  {presentation.title} — {presentation.sequence.index} of{" "}
                  {presentation.sequence.total}
                </p>
              ) : (
                <p
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-[0.16em]",
                    isTerminal ? "text-emerald-400/80" : "text-muted-foreground",
                  )}
                >
                  {presentation.title}
                </p>
              )}
              <DialogPrimitive.Title
                id={titleId}
                className={cn(
                  "text-[1.25rem] font-semibold tracking-tight sm:text-[1.35rem]",
                  isTerminal ? "text-emerald-50" : "text-foreground",
                )}
              >
                {presentation.headline}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description
                id={descId}
                className={cn(
                  "text-[13px] leading-relaxed",
                  isTerminal ? "text-emerald-100/70" : "text-muted-foreground",
                )}
              >
                {presentation.explanation}
              </DialogPrimitive.Description>
              <p
                className={cn(
                  "text-[11px] leading-snug",
                  isTerminal ? "text-emerald-200/45" : "text-muted-foreground/80",
                )}
              >
                {presentation.virtualEconomyDisclaimer}
              </p>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-0.5">
              {presentation.isUpdate ? (
                <ul className="space-y-1.5 rounded-md border border-border/60 bg-surface-2/40 px-3 py-2 text-[12px]">
                  {presentation.documents
                    .filter((d) => d.changed)
                    .map((doc) => (
                      <li key={doc.documentId}>
                        <span className="font-medium">{doc.title}</span>
                        {doc.previousVersion ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · was v{doc.previousVersion}, now v{doc.version}
                          </span>
                        ) : (
                          <span className="text-muted-foreground"> · v{doc.version}</span>
                        )}
                      </li>
                    ))}
                </ul>
              ) : null}

              <div className="space-y-2">
                <p
                  className={cn(
                    "text-[11px] font-medium uppercase tracking-[0.12em]",
                    isTerminal ? "text-emerald-400/70" : "text-muted-foreground",
                  )}
                >
                  Documents
                </p>
                <ul className="space-y-1.5">
                  {presentation.documents.map((doc) => (
                    <li key={doc.documentId}>
                      <a
                        href={doc.publicPath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "inline-flex min-h-11 items-center gap-2 text-[13px] underline-offset-2 hover:underline",
                          isTerminal ? "text-emerald-300" : "text-foreground",
                        )}
                      >
                        {doc.title}
                        <span className="font-mono text-[11px] opacity-70">v{doc.version}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2.5" role="group" aria-label="Consent confirmations">
                {presentation.controlGroups.map((group, index) => (
                  <label
                    key={group.id}
                    htmlFor={`consent-${group.id}`}
                    className={cn(
                      "flex cursor-pointer gap-3 rounded-lg border px-3.5 py-3 transition-colors",
                      isTerminal
                        ? "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40"
                        : "border-border/70 bg-surface-2/30 hover:border-border",
                      "focus-within:ring-2",
                      isTerminal
                        ? "focus-within:ring-emerald-500/40"
                        : "focus-within:ring-ring/40",
                    )}
                  >
                    <input
                      ref={index === 0 ? firstCheckboxRef : undefined}
                      id={`consent-${group.id}`}
                      type="checkbox"
                      checked={Boolean(checked[group.id])}
                      disabled={submitting || success}
                      onChange={(e) => onToggle(group.id, e.target.checked)}
                      className={cn(
                        "mt-0.5 h-5 w-5 shrink-0 rounded",
                        isTerminal
                          ? "border-emerald-500/50 text-emerald-500"
                          : "border-border text-foreground",
                      )}
                    />
                    <span className="text-[13px] leading-snug">{group.label}</span>
                  </label>
                ))}
              </div>

              <div id={statusId} aria-live="polite" className="min-h-[1.25rem] text-[12px]">
                {error ? (
                  <p className="text-red-500" role="alert">
                    {error}
                  </p>
                ) : null}
                {success ? (
                  <p className={isTerminal ? "text-emerald-300" : "text-foreground"}>
                    Accepted. Continuing…
                  </p>
                ) : null}
                {submitting && !success ? <p className="text-muted-foreground">Recording…</p> : null}
              </div>
            </div>

            <footer className="shrink-0 space-y-3 border-t border-border/40 pt-3 pb-1">
              <button
                type="button"
                disabled={!allChecked || submitting || success}
                onClick={onSubmit}
                className={cn(
                  "inline-flex min-h-11 w-full items-center justify-center rounded-md px-4 text-[14px] font-semibold",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-45",
                  "motion-safe:active:scale-[0.99] motion-reduce:transition-none",
                  isTerminal
                    ? "bg-emerald-500 text-black focus-visible:ring-emerald-400/60 focus-visible:ring-offset-[#0a0f0c]"
                    : "bg-foreground text-background focus-visible:ring-ring focus-visible:ring-offset-background",
                )}
              >
                Agree and continue
              </button>
              <ProductConsentSafeExitLinks
                safeExitHref={safeExitHref}
                safeExitLabel={safeExitLabel}
              />
            </footer>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
