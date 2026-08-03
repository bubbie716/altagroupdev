/**
 * Short-lived Admin Copilot conversation context (server memory).
 * Never crosses users, sessions, or site scopes. Does not persist sensitive transcripts.
 */
import type { AdminCopilotEntityMatch, AdminCopilotToolId } from "@/lib/internal/copilot/types";

const TTL_MS = 15 * 60_000;
const MAX_ENTITIES = 6;
const MAX_ENTRIES = 500;

export type CopilotConversationContext = {
  conversationId: string;
  operatorUserId: string;
  siteKey: string;
  updatedAt: number;
  /** Presentation-safe focus entities for follow-ups ("their accounts"). */
  focusEntities: AdminCopilotEntityMatch[];
  lastTools: AdminCopilotToolId[];
  lastUserText?: string;
};

const store = new Map<string, CopilotConversationContext>();

function key(operatorUserId: string, conversationId: string, siteKey: string): string {
  return `${operatorUserId}::${siteKey}::${conversationId}`;
}

function prune(): void {
  const now = Date.now();
  for (const [k, v] of store) {
    if (now - v.updatedAt > TTL_MS) store.delete(k);
  }
  if (store.size <= MAX_ENTRIES) return;
  const ordered = [...store.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt);
  for (let i = 0; i < ordered.length - MAX_ENTRIES; i++) {
    store.delete(ordered[i]![0]);
  }
}

export function getCopilotConversationContext(input: {
  operatorUserId: string;
  conversationId: string;
  siteKey: string;
}): CopilotConversationContext | null {
  prune();
  const row = store.get(key(input.operatorUserId, input.conversationId, input.siteKey));
  if (!row) return null;
  if (row.operatorUserId !== input.operatorUserId) return null;
  if (row.siteKey !== input.siteKey) return null;
  if (Date.now() - row.updatedAt > TTL_MS) {
    store.delete(key(input.operatorUserId, input.conversationId, input.siteKey));
    return null;
  }
  return row;
}

export function updateCopilotConversationContext(input: {
  operatorUserId: string;
  conversationId: string;
  siteKey: string;
  matches?: AdminCopilotEntityMatch[];
  tools?: AdminCopilotToolId[];
  lastUserText?: string;
}): CopilotConversationContext {
  prune();
  const k = key(input.operatorUserId, input.conversationId, input.siteKey);
  const prev = store.get(k);
  const focus = (input.matches?.length ? input.matches : prev?.focusEntities ?? []).slice(
    0,
    MAX_ENTITIES,
  );
  const next: CopilotConversationContext = {
    conversationId: input.conversationId,
    operatorUserId: input.operatorUserId,
    siteKey: input.siteKey,
    updatedAt: Date.now(),
    focusEntities: focus.map((m) => ({
      entityType: m.entityType,
      entityId: m.entityId,
      label: m.label,
      sublabel: m.sublabel,
      status: m.status,
      href: m.href,
    })),
    lastTools: (input.tools ?? prev?.lastTools ?? []).slice(-8),
    lastUserText: input.lastUserText?.slice(0, 120) ?? prev?.lastUserText,
  };
  store.set(k, next);
  return next;
}

export function formatContextSummaryForModel(ctx: CopilotConversationContext | null): string {
  if (!ctx || ctx.focusEntities.length === 0) return "";
  const lines = ctx.focusEntities.slice(0, 4).map(
    (e) => `${e.entityType}:${e.entityId}:${e.label}`,
  );
  return `Prior focus (untrusted): ${lines.join("; ")}. Pronouns may refer to these.`;
}

/** Only attach prior focus when the operator uses follow-up language (saves tokens). */
export function commandNeedsConversationContext(text: string): boolean {
  return /\b(their|them|those|that\s+(?:one|person|account|customer)|same|previous|last\s+one|follow[\s-]?up)\b/i.test(
    text,
  );
}

/** Test helper — clear memory between unit tests. */
export function __resetCopilotConversationContextForTests(): void {
  store.clear();
}
