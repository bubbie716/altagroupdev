"use client";

import { useEffect, useId, useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Link } from "@tanstack/react-router";
import { Checkbox } from "@/components/ui/checkbox";
import { OVERLAY_SCRIM_CLASS } from "@/lib/ui/overlay-layers";
import { cn } from "@/lib/utils";

function ProductConsentSafeExitLinks({
  safeExitHref,
  safeExitLabel,
  onSafeExit,
}: {
  safeExitHref: string;
  safeExitLabel: string;
  onSafeExit?: () => void;
}) {
  if (safeExitHref === "#" && onSafeExit) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[12px] text-muted-foreground">
        <button
          type="button"
          onClick={onSafeExit}
          className="min-h-11 underline-offset-2 hover:underline"
        >
          {safeExitLabel}
        </button>
        <a href="/legal" className="inline-flex min-h-11 items-center underline-offset-2 hover:underline">
          Legal
        </a>
        <a href="/support" className="inline-flex min-h-11 items-center underline-offset-2 hover:underline">
          Support
        </a>
      </div>
    );
  }
  if (safeExitHref === "#") {
    return (
      <div className="flex justify-center text-[12px] text-muted-foreground">
        <span>Complete consent to continue, or close the funding form.</span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[12px] text-muted-foreground">
      <Link to={safeExitHref} className="inline-flex min-h-11 items-center underline-offset-2 hover:underline">
        {safeExitLabel}
      </Link>
      <a href="/legal" className="inline-flex min-h-11 items-center underline-offset-2 hover:underline">
        Legal
      </a>
      <a href="/support" className="inline-flex min-h-11 items-center underline-offset-2 hover:underline">
        Support
      </a>
      <a href="/api/auth/logout" className="inline-flex min-h-11 items-center underline-offset-2 hover:underline">
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
 * Progressive product consent dialog.
 * Blocking mode: Escape/backdrop cannot dismiss; safe exit links remain.
 * Soft informational notices use ProductConsentSoftNotice instead.
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
  blocking = true,
  onSafeExit,
  onDismiss,
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
  /** When true (default), Escape/backdrop cannot dismiss. */
  blocking?: boolean;
  onSafeExit?: () => void;
  /** Soft/dismissible only — ignored when blocking. */
  onDismiss?: () => void;
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
    <DialogPrimitive.Root
      open={open}
      modal={blocking}
      onOpenChange={(next) => {
        if (!next && !blocking) onDismiss?.();
      }}
    >
      <DialogPrimitive.Portal>
        <div
          aria-hidden
          className={cn(
            "fixed inset-0 z-[140]",
            OVERLAY_SCRIM_CLASS,
            "motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0",
            "motion-reduce:transition-none",
          )}
        />
        <DialogPrimitive.Content
          aria-labelledby={titleId}
          aria-describedby={descId}
          onEscapeKeyDown={(event) => {
            if (blocking) {
              event.preventDefault();
              return;
            }
            onDismiss?.();
          }}
          onPointerDownOutside={(event) => {
            if (blocking) {
              event.preventDefault();
              return;
            }
            onDismiss?.();
          }}
          onInteractOutside={(event) => {
            if (blocking) {
              event.preventDefault();
            }
          }}
          className={cn(
            "fixed z-[150] flex flex-col outline-none",
            // Fit below UI Lab banner; one scroll container for the body.
            "left-0 right-0 bottom-0",
            "top-[var(--ui-lab-banner-height,0px)]",
            "max-h-[calc(100dvh-var(--ui-lab-banner-height,0px))]",
            "max-h-[calc(100svh-var(--ui-lab-banner-height,0px))]",
            "rounded-t-2xl",
            "pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]",
            "pt-2",
            // Desktop: centered modal within available viewport below banner.
            "sm:inset-auto sm:left-1/2",
            "sm:top-[max(1rem,calc(var(--ui-lab-banner-height,0px)+1rem))]",
            "sm:bottom-auto sm:w-[min(100%-2rem,28rem)]",
            "sm:max-h-[min(calc(100dvh-var(--ui-lab-banner-height,0px)-2rem),40rem)]",
            "sm:-translate-x-1/2 sm:rounded-xl sm:pt-5",
            isTerminal
              ? "border border-white/12 bg-[#0c0e10] text-white shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
              : "border border-border bg-surface-1 text-foreground shadow-xl",
            "motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0",
            "motion-safe:sm:data-[state=open]:zoom-in-95",
            "motion-reduce:transition-none",
          )}
        >
          <div
            className={cn(
              "mx-auto mb-2 h-1 w-10 shrink-0 rounded-full sm:hidden",
              isTerminal ? "bg-white/25" : "bg-muted-foreground/30",
            )}
            aria-hidden
          />

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 sm:px-6">
            <header className="shrink-0 space-y-2 pb-3">
              {presentation.sequence && presentation.sequence.total > 1 ? (
                <p
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-[0.16em]",
                    isTerminal ? "text-emerald-400" : "text-muted-foreground",
                  )}
                >
                  {presentation.title} — {presentation.sequence.index} of{" "}
                  {presentation.sequence.total}
                </p>
              ) : (
                <p
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-[0.16em]",
                    isTerminal ? "text-white/55" : "text-muted-foreground",
                  )}
                >
                  {presentation.title}
                </p>
              )}
              <DialogPrimitive.Title
                id={titleId}
                className={cn(
                  "text-[1.25rem] font-semibold tracking-tight sm:text-[1.35rem]",
                  isTerminal ? "text-white" : "text-foreground",
                )}
              >
                {presentation.headline}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description
                id={descId}
                className={cn(
                  "text-[13px] leading-relaxed",
                  isTerminal ? "text-white/65" : "text-muted-foreground",
                )}
              >
                {presentation.explanation}
              </DialogPrimitive.Description>
              <p
                className={cn(
                  "text-[11px] leading-snug",
                  isTerminal ? "text-white/45" : "text-muted-foreground/80",
                )}
              >
                {presentation.virtualEconomyDisclaimer}
              </p>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-0.5">
              {presentation.isUpdate ? (
                <ul
                  className={cn(
                    "space-y-1.5 rounded-md border px-3 py-2 text-[12px]",
                    isTerminal
                      ? "border-white/10 bg-white/[0.03]"
                      : "border-border/60 bg-surface-2/40",
                  )}
                >
                  {presentation.documents
                    .filter((d) => d.changed)
                    .map((doc) => (
                      <li key={doc.documentId}>
                        <span className="font-medium">{doc.title}</span>
                        {doc.previousVersion ? (
                          <span className={isTerminal ? "text-white/50" : "text-muted-foreground"}>
                            {" "}
                            · was v{doc.previousVersion}, now v{doc.version}
                          </span>
                        ) : (
                          <span className={isTerminal ? "text-white/50" : "text-muted-foreground"}>
                            {" "}
                            · v{doc.version}
                          </span>
                        )}
                      </li>
                    ))}
                </ul>
              ) : null}

              <div className="space-y-2">
                <p
                  className={cn(
                    "text-[11px] font-medium uppercase tracking-[0.12em]",
                    isTerminal ? "text-white/50" : "text-muted-foreground",
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
                          isTerminal ? "text-white" : "text-foreground",
                        )}
                      >
                        {doc.title}
                        <span
                          className={cn(
                            "font-mono text-[11px]",
                            isTerminal ? "text-white/45" : "opacity-70",
                          )}
                        >
                          v{doc.version}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2.5 pb-1" role="group" aria-label="Consent confirmations">
                {presentation.controlGroups.map((group, index) => (
                  <label
                    key={group.id}
                    htmlFor={`consent-${group.id}`}
                    className={cn(
                      "flex min-h-11 cursor-pointer gap-3 rounded-lg border px-3.5 py-3 transition-colors",
                      isTerminal
                        ? "border-white/12 bg-transparent hover:border-white/22 hover:bg-white/[0.03]"
                        : "border-border/70 bg-surface-2/30 hover:border-border",
                      "focus-within:ring-2",
                      isTerminal
                        ? "focus-within:ring-emerald-500/45"
                        : "focus-within:ring-ring/40",
                      checked[group.id] &&
                        (isTerminal
                          ? "border-emerald-500/50 bg-emerald-500/10"
                          : "border-foreground/40"),
                    )}
                  >
                    <Checkbox
                      ref={index === 0 ? firstCheckboxRef : undefined}
                      id={`consent-${group.id}`}
                      checked={Boolean(checked[group.id])}
                      disabled={submitting || success}
                      onChange={(e) => onToggle(group.id, e.target.checked)}
                      className={
                        isTerminal
                          ? "border-white/35 checked:border-emerald-500 checked:bg-emerald-500 focus-visible:ring-emerald-500/40"
                          : "border-border checked:border-foreground checked:bg-foreground"
                      }
                    />
                    <span
                      className={cn(
                        "text-[13px] leading-snug",
                        isTerminal ? "text-white/90" : undefined,
                      )}
                    >
                      {group.label}
                    </span>
                  </label>
                ))}
              </div>

              <div id={statusId} aria-live="polite" className="min-h-[1.25rem] text-[12px]">
                {error ? (
                  <p className="text-red-400" role="alert">
                    {error}
                  </p>
                ) : null}
                {success ? (
                  <p className={isTerminal ? "text-emerald-400" : "text-foreground"}>
                    Accepted. Continuing…
                  </p>
                ) : null}
                {submitting && !success ? (
                  <p className={isTerminal ? "text-white/55" : "text-muted-foreground"}>
                    Recording…
                  </p>
                ) : null}
              </div>
            </div>

            <footer
              className={cn(
                "shrink-0 space-y-3 border-t pt-3",
                isTerminal ? "border-white/10" : "border-border/40",
              )}
            >
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
                    ? "bg-emerald-500 text-black focus-visible:ring-emerald-400/60 focus-visible:ring-offset-[#0c0e10]"
                    : "bg-foreground text-background focus-visible:ring-ring focus-visible:ring-offset-background",
                )}
              >
                Agree and continue
              </button>
              <ProductConsentSafeExitLinks
                safeExitHref={safeExitHref}
                safeExitLabel={safeExitLabel}
                onSafeExit={onSafeExit}
              />
            </footer>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
