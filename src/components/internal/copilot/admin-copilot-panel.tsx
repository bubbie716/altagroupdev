"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canAccessInternalForSite } from "@/lib/auth/permissions";
import { useSiteContext } from "@/hooks/use-site-context";
import {
  createAdminCopilotNavigationFn,
  runAdminCopilotCommandFn,
} from "@/lib/internal/copilot/admin-copilot.functions";
import {
  ADMIN_COPILOT_EXAMPLE_PROMPTS,
  type AdminCopilotEntityMatch,
  type AdminCopilotNavigationIntent,
  type AdminCopilotResult,
} from "@/lib/internal/copilot/types";
import { cn } from "@/lib/utils";

type Turn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  result?: AdminCopilotResult;
};

function MatchCard({
  match,
  onOpen,
  disabled,
}: {
  match: AdminCopilotEntityMatch;
  onOpen: (match: AdminCopilotEntityMatch) => void;
  disabled?: boolean;
}) {
  const openLabel =
    match.entityType === "user"
      ? "Open customer"
      : match.entityType === "account"
        ? "Open account"
        : match.entityType === "company"
          ? "Open company"
          : match.entityType === "deal_room" || match.entityType === "lending_application"
            ? "Open deal room"
            : match.entityType === "loan"
              ? "Open loan"
              : match.entityType === "transaction" || match.entityType === "transfer"
                ? "Open transaction"
                : "Open record";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onOpen(match)}
      className="flex w-full flex-col gap-1 rounded-md border border-border/70 bg-surface-1 px-3 py-2.5 text-left transition-colors hover:border-border-strong hover:bg-surface-2/50 disabled:opacity-50"
    >
      <span className="text-[13px] font-medium text-foreground">{match.label}</span>
      <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {match.entityType.replace(/_/g, " ")}
        {match.status ? ` · ${match.status}` : ""}
      </span>
      {match.sublabel ? (
        <span className="text-[12px] text-muted-foreground">{match.sublabel}</span>
      ) : null}
      <span className="mt-0.5 text-[12px] font-medium text-gold">{openLabel} →</span>
    </button>
  );
}

function ProviderBadge({
  status,
}: {
  status?: AdminCopilotResult["providerStatus"] | "idle";
}) {
  if (status === "unavailable") {
    return (
      <span className="rounded border border-amber-500/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-400">
        AI unavailable
      </span>
    );
  }
  if (status === "ai") {
    return (
      <span className="rounded border border-gold/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-gold">
        AI
      </span>
    );
  }
  if (status === "ui_lab") {
    return (
      <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        UI Lab
      </span>
    );
  }
  return (
    <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
      Read-only
    </span>
  );
}

function newConversationId(): string {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AdminCopilotPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const site = useSiteContext();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const runCommand = useServerFn(runAdminCopilotCommandFn);
  const createNav = useServerFn(createAdminCopilotNavigationFn);
  const inputId = useId();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [providerStatus, setProviderStatus] = useState<
    AdminCopilotResult["providerStatus"] | "idle"
  >("idle");
  const conversationIdRef = useRef(newConversationId());

  const allowed = Boolean(user) && canAccessInternalForSite(user!, site.key);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  async function navigateIntent(intent: AdminCopilotNavigationIntent) {
    onOpenChange(false);
    await navigate({
      to: intent.to as "/",
      search: intent.search,
    });
  }

  async function openMatch(match: AdminCopilotEntityMatch) {
    setBusy(true);
    setError(null);
    try {
      const res = (await createNav({
        data: {
          href: match.href,
          siteKey: site.key,
          entityType: match.entityType,
          entityId: match.entityId,
          reason: `Open ${match.label}`,
          from: pathname.startsWith("/internal") ? pathname : undefined,
        },
      })) as
        | { ok: true; intent: AdminCopilotNavigationIntent }
        | { ok: false; reason: string };
      if (!res.ok) {
        setError(res.reason);
        return;
      }
      await navigateIntent(res.intent);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open record.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(text: string) {
    const command = text.trim();
    if (!command || busy) return;
    setBusy(true);
    setError(null);
    setProgressLabel("Thinking…");
    setInput("");
    setTurns((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", text: command },
    ]);

    try {
      const params = new URLSearchParams(
        typeof window !== "undefined" ? window.location.search : "",
      );
      const scenario = params.get("copilotScenario") ?? undefined;

      const result = (await runCommand({
        data: {
          text: command,
          siteKey: site.key,
          scenario,
          currentPath: pathname,
          from: pathname.startsWith("/internal") ? pathname : undefined,
          conversationId: conversationIdRef.current,
        },
      })) as AdminCopilotResult;

      if (result.providerStatus) setProviderStatus(result.providerStatus);
      const lastProgress = result.toolProgress?.at(-1)?.label;
      if (lastProgress) setProgressLabel(lastProgress);

      setTurns((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: result.message,
          result,
        },
      ]);

      if (result.kind === "navigate" && result.navigation) {
        await navigateIntent(result.navigation);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Request failed.";
      setError(message);
      setTurns((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: message,
          result: {
            kind: "error",
            message,
            correlationId: "client-error",
          },
        },
      ]);
    } finally {
      setBusy(false);
      setProgressLabel(null);
    }
  }

  if (!allowed) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        className={cn(
          "flex max-h-[min(92dvh,720px)] w-[calc(100vw-1rem)] max-w-lg flex-col gap-0 overflow-hidden p-0",
          "max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:max-h-[92dvh] max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:border-x-0",
        )}
        onEscapeKeyDown={() => onOpenChange(false)}
      >
        <DialogHeader className="shrink-0 border-b border-border/70 px-4 py-3 text-left">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="flex flex-wrap items-center gap-2 text-[15px]">
                <Sparkles className="size-4 shrink-0 text-gold" aria-hidden />
                Admin Copilot
                <ProviderBadge status={providerStatus} />
              </DialogTitle>
              <DialogDescription className="mt-1 text-[12px] text-muted-foreground">
                Read-only AI lookup and navigation · {site.entityName}
              </DialogDescription>
            </div>
            <button
              type="button"
              className="-mr-1.5 -mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-2 hover:text-foreground"
              aria-label="Close Admin Copilot"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </DialogHeader>

        <div
          id={listId}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          {turns.length === 0 ? (
            <div className="space-y-3">
              <p className="text-[13px] text-muted-foreground">
                Ask to open a customer, company, deal room, or ops surface. Example prompts:
              </p>
              <ul className="flex flex-col gap-1.5">
                {ADMIN_COPILOT_EXAMPLE_PROMPTS.slice(0, 6).map((prompt) => (
                  <li key={prompt}>
                    <button
                      type="button"
                      className="w-full rounded-md border border-border/60 px-3 py-2 text-left text-[12px] text-foreground hover:border-border-strong hover:bg-surface-2/40"
                      onClick={() => void submit(prompt)}
                    >
                      {prompt}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {turns.map((turn) => (
            <div
              key={turn.id}
              className={cn(
                "rounded-md px-3 py-2 text-[13px]",
                turn.role === "user"
                  ? "ml-6 bg-foreground text-background"
                  : "mr-2 border border-border/60 bg-surface-1 text-foreground",
              )}
            >
              {turn.role === "assistant" && turn.result?.answer ? (
                <p className="text-[22px] font-semibold tracking-tight text-foreground">
                  {turn.result.answer}
                </p>
              ) : null}
              <p
                className={cn(
                  "leading-relaxed",
                  turn.result?.answer ? "mt-1 text-[13px] text-muted-foreground" : undefined,
                )}
              >
                {turn.text}
              </p>
              {turn.result?.matches && turn.result.matches.length > 0 ? (
                <div className="mt-3 space-y-1.5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Sources
                  </p>
                  {turn.result.matches.map((m) => (
                    <MatchCard
                      key={`${m.entityType}-${m.entityId}`}
                      match={m}
                      onOpen={openMatch}
                      disabled={busy}
                    />
                  ))}
                </div>
              ) : null}
              {turn.result?.kind === "navigate" && turn.result.navigation ? (
                <p className="mt-2 text-[11px] text-muted-foreground">Navigating…</p>
              ) : null}
              {turn.result?.kind === "unavailable" &&
              !(turn.result.matches && turn.result.matches.length > 0) ? (
                <p className="mt-2 text-[12px] text-amber-700 dark:text-amber-400">
                  AI unavailable — configure an Admin Copilot provider or use UI Lab fixtures.
                </p>
              ) : null}
              {turn.result?.kind === "error" && /rate limit/i.test(turn.result.message) ? (
                <p className="mt-2 text-[12px] text-amber-700 dark:text-amber-400">
                  Rate limited by the AI provider. Wait a few seconds, then ask again.
                </p>
              ) : null}
              {turn.result?.kind === "read_only_blocked" ? (
                <p className="mt-2 text-[12px] text-muted-foreground">
                  Mutation requests are not executed in this phase.
                </p>
              ) : null}
              {turn.result?.kind === "ambiguous" ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Choose a record — Copilot will not guess between matches.
                </p>
              ) : null}
              {turn.result?.kind === "not_found" ? (
                <p className="mt-2 text-[12px] text-muted-foreground">
                  No authorized record matched that name.
                </p>
              ) : null}
            </div>
          ))}

          {busy ? (
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground" role="status">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              {progressLabel ?? "Searching…"}
            </div>
          ) : null}

          {error ? (
            <p className="text-[12px] text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <form
          className="shrink-0 border-t border-border/70 px-3 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(input);
          }}
        >
          <label htmlFor={inputId} className="sr-only">
            Admin Copilot command
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              id={inputId}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={busy}
              placeholder='Try “Open FTLCEO’s deal room.”'
              autoComplete="off"
              className="min-h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-[14px] outline-none focus-visible:border-gold/60"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="inline-flex min-h-11 shrink-0 items-center rounded-md bg-foreground px-3.5 text-[13px] font-medium text-background disabled:opacity-40"
            >
              Ask
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AdminCopilotTrigger({ className }: { className?: string }) {
  const user = useCurrentUser();
  const site = useSiteContext();
  const [open, setOpen] = useState(false);

  const allowed = Boolean(user) && canAccessInternalForSite(user!, site.key);

  if (!allowed) return null;

  return (
    <>
      <button
        type="button"
        className={cn(
          "inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-border/80 text-foreground hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
        aria-label="Open Admin Copilot"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Sparkles className="size-4" aria-hidden />
      </button>
      <AdminCopilotPanel open={open} onOpenChange={setOpen} />
    </>
  );
}
