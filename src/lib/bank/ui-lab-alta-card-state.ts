/**
 * SessionStorage-backed Alta Card mock mutations for UI Lab only.
 * Never touches production balances or Discord.
 */
import { isUiLabMode, UI_LAB_MOCK_USER } from "@/lib/auth/ui-lab";
import type { AltaCardRow, AltaCardStatusCode } from "@/lib/bank/alta-card-types";

const OVERLAY_STORAGE_KEY = "alta.uiLab.altaCardOverlays";
const AUDIT_STORAGE_KEY = "alta.uiLab.altaCardAuditEvents";

export type UiLabAltaCardOverlay = {
  status?: "active" | "frozen";
  currentBalance?: number;
  availableCredit?: number;
  creditLimit?: number;
  autopayEnabled?: boolean;
  /** Cumulative payments applied in UI Lab (reduces balance / restores credit). */
  paymentApplied?: number;
  /** Cumulative cash advances in UI Lab (increases balance / uses credit). */
  cashAdvanceApplied?: number;
};

export type UiLabAltaCardAuditEvent = {
  id: string;
  cardId: string;
  action: "freeze" | "unfreeze" | "payment" | "cash_advance" | "autopay";
  amount?: number;
  enabled?: boolean;
  at: string;
};

type OverlayMap = Record<string, UiLabAltaCardOverlay>;

let memoryOverlays: OverlayMap = {};
let memoryAudit: UiLabAltaCardAuditEvent[] = [];
let overlayRevision = 0;
const overlayListeners = new Set<() => void>();

function bumpOverlayRevision(): void {
  overlayRevision += 1;
  for (const listener of overlayListeners) listener();
}

/** Subscribe to overlay mutations (for React useSyncExternalStore). */
export function subscribeUiLabAltaCardOverlays(listener: () => void): () => void {
  overlayListeners.add(listener);
  return () => {
    overlayListeners.delete(listener);
  };
}

export function getUiLabAltaCardOverlayRevision(): number {
  return overlayRevision;
}

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

/** Pure read of overlay map (session or memory). Exported for tests. */
export function readUiLabAltaCardOverlayMap(): OverlayMap {
  if (canUseSessionStorage()) {
    try {
      const raw = window.sessionStorage.getItem(OVERLAY_STORAGE_KEY);
      if (!raw) return { ...memoryOverlays };
      const parsed = JSON.parse(raw) as OverlayMap;
      return { ...memoryOverlays, ...parsed };
    } catch {
      return { ...memoryOverlays };
    }
  }
  return { ...memoryOverlays };
}

/** Pure write of overlay map. Exported for tests. */
export function writeUiLabAltaCardOverlayMap(map: OverlayMap): void {
  memoryOverlays = { ...map };
  if (canUseSessionStorage()) {
    try {
      window.sessionStorage.setItem(OVERLAY_STORAGE_KEY, JSON.stringify(map));
    } catch {
      /* ignore quota / private mode */
    }
  }
  bumpOverlayRevision();
}

function readAuditEvents(): UiLabAltaCardAuditEvent[] {
  if (canUseSessionStorage()) {
    try {
      const raw = window.sessionStorage.getItem(AUDIT_STORAGE_KEY);
      if (!raw) return [...memoryAudit];
      const parsed = JSON.parse(raw) as UiLabAltaCardAuditEvent[];
      return Array.isArray(parsed) ? parsed : [...memoryAudit];
    } catch {
      return [...memoryAudit];
    }
  }
  return [...memoryAudit];
}

function writeAuditEvents(events: UiLabAltaCardAuditEvent[]): void {
  memoryAudit = [...events];
  if (!canUseSessionStorage()) return;
  try {
    window.sessionStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(events));
  } catch {
    /* ignore */
  }
}

/** Reset in-memory + session overlays (tests). */
export function resetUiLabAltaCardStateForTests(): void {
  memoryOverlays = {};
  memoryAudit = [];
  if (canUseSessionStorage()) {
    try {
      window.sessionStorage.removeItem(OVERLAY_STORAGE_KEY);
      window.sessionStorage.removeItem(AUDIT_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  bumpOverlayRevision();
}

export function getUiLabAltaCardOverlay(cardId: string): UiLabAltaCardOverlay | null {
  if (!isUiLabMode()) return null;
  const map = readUiLabAltaCardOverlayMap();
  return map[cardId] ?? null;
}

function putOverlay(cardId: string, patch: UiLabAltaCardOverlay): UiLabAltaCardOverlay {
  const map = readUiLabAltaCardOverlayMap();
  const next = { ...map[cardId], ...patch };
  map[cardId] = next;
  writeUiLabAltaCardOverlayMap(map);
  return next;
}

/** Pure overlay mutation helpers (no UI Lab gate) — for unit tests. */
export function applyFreezeToOverlay(
  overlay: UiLabAltaCardOverlay | null,
  frozen: boolean,
): UiLabAltaCardOverlay {
  return { ...overlay, status: frozen ? "frozen" : "active" };
}

export function applyPaymentToOverlay(
  overlay: UiLabAltaCardOverlay | null,
  amount: number,
): UiLabAltaCardOverlay {
  const prev = overlay ?? {};
  const paymentApplied = (prev.paymentApplied ?? 0) + amount;
  const next: UiLabAltaCardOverlay = { ...prev, paymentApplied };
  if (prev.currentBalance !== undefined) {
    next.currentBalance = Math.max(0, prev.currentBalance - amount);
  }
  if (prev.availableCredit !== undefined) {
    const limit = prev.creditLimit;
    const restored = prev.availableCredit + amount;
    next.availableCredit = limit != null ? Math.min(limit, restored) : restored;
  }
  return next;
}

export function applyCashAdvanceToOverlay(
  overlay: UiLabAltaCardOverlay | null,
  amount: number,
): UiLabAltaCardOverlay {
  const prev = overlay ?? {};
  const cashAdvanceApplied = (prev.cashAdvanceApplied ?? 0) + amount;
  const next: UiLabAltaCardOverlay = { ...prev, cashAdvanceApplied };
  if (prev.currentBalance !== undefined) {
    next.currentBalance = prev.currentBalance + amount;
  }
  if (prev.availableCredit !== undefined) {
    next.availableCredit = Math.max(0, prev.availableCredit - amount);
  }
  return next;
}

export function applyAutopayToOverlay(
  overlay: UiLabAltaCardOverlay | null,
  enabled: boolean,
): UiLabAltaCardOverlay {
  return { ...overlay, autopayEnabled: enabled };
}

export function mergeOverlayOntoCard(
  card: AltaCardRow,
  overlay: UiLabAltaCardOverlay | null,
): AltaCardRow {
  if (!overlay) return card;
  const payment = overlay.paymentApplied ?? 0;
  const advance = overlay.cashAdvanceApplied ?? 0;
  const net = advance - payment;
  const creditLimit = overlay.creditLimit ?? card.creditLimit;
  const currentBalance =
    overlay.currentBalance !== undefined
      ? overlay.currentBalance
      : Math.max(0, card.currentBalance + net);
  const availableCredit =
    overlay.availableCredit !== undefined
      ? overlay.availableCredit
      : Math.max(0, Math.min(creditLimit, card.availableCredit - net));

  let status: AltaCardStatusCode = card.status;
  if (overlay.status === "frozen") status = "frozen";
  else if (overlay.status === "active" && (card.status === "frozen" || card.status === "active")) {
    status = "active";
  }

  return {
    ...card,
    status,
    creditLimit,
    currentBalance,
    availableCredit,
  };
}

export function recordUiLabAuditEvent(
  event: Omit<UiLabAltaCardAuditEvent, "id" | "at"> & { id?: string; at?: string },
): UiLabAltaCardAuditEvent | null {
  if (!isUiLabMode()) return null;
  const full: UiLabAltaCardAuditEvent = {
    id: event.id ?? `ui-lab-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    cardId: event.cardId,
    action: event.action,
    amount: event.amount,
    enabled: event.enabled,
    at: event.at ?? new Date().toISOString(),
  };
  const events = readAuditEvents();
  events.unshift(full);
  writeAuditEvents(events.slice(0, 50));
  return full;
}

export function listUiLabAuditEvents(cardId?: string): UiLabAltaCardAuditEvent[] {
  if (!isUiLabMode()) return [];
  const events = readAuditEvents();
  if (!cardId) return events;
  return events.filter((e) => e.cardId === cardId);
}

export function applyUiLabAltaCardFreeze(cardId: string, frozen: boolean): UiLabAltaCardOverlay | null {
  if (!isUiLabMode()) return null;
  const next = putOverlay(cardId, applyFreezeToOverlay(readUiLabAltaCardOverlayMap()[cardId] ?? null, frozen));
  recordUiLabAuditEvent({ cardId, action: frozen ? "freeze" : "unfreeze" });
  return next;
}

export function applyUiLabAltaCardPayment(cardId: string, amount: number): UiLabAltaCardOverlay | null {
  if (!isUiLabMode()) return null;
  if (!(amount > 0)) return getUiLabAltaCardOverlay(cardId);
  const next = putOverlay(cardId, applyPaymentToOverlay(readUiLabAltaCardOverlayMap()[cardId] ?? null, amount));
  recordUiLabAuditEvent({ cardId, action: "payment", amount });
  return next;
}

export function applyUiLabAltaCardCashAdvance(
  cardId: string,
  amount: number,
): UiLabAltaCardOverlay | null {
  if (!isUiLabMode()) return null;
  if (!(amount > 0)) return getUiLabAltaCardOverlay(cardId);
  const next = putOverlay(
    cardId,
    applyCashAdvanceToOverlay(readUiLabAltaCardOverlayMap()[cardId] ?? null, amount),
  );
  recordUiLabAuditEvent({ cardId, action: "cash_advance", amount });
  return next;
}

export function applyUiLabAltaCardAutopay(
  cardId: string,
  enabled: boolean,
): UiLabAltaCardOverlay | null {
  if (!isUiLabMode()) return null;
  const next = putOverlay(cardId, applyAutopayToOverlay(readUiLabAltaCardOverlayMap()[cardId] ?? null, enabled));
  recordUiLabAuditEvent({ cardId, action: "autopay", enabled });
  return next;
}

export function mergeUiLabAltaCardRow(card: AltaCardRow): AltaCardRow {
  if (!isUiLabMode()) return card;
  return mergeOverlayOntoCard(card, getUiLabAltaCardOverlay(card.id));
}

/** Resolve company display name from UI Lab memberships when enabled. */
export function resolveUiLabCompanyName(companyId: string): string | null {
  if (!isUiLabMode()) return null;
  const membership = UI_LAB_MOCK_USER.companyMemberships.find((m) => m.companyId === companyId);
  return membership?.companyName ?? null;
}

/**
 * Prefer loader card / pending app names, then UI Lab memberships when in UI Lab mode.
 */
export function resolveCompanyDisplayName(
  companyId: string,
  fallbacks: { cardCompanyName?: string | null; pendingCompanyName?: string | null } = {},
): string {
  if (fallbacks.cardCompanyName?.trim()) return fallbacks.cardCompanyName.trim();
  if (fallbacks.pendingCompanyName?.trim()) return fallbacks.pendingCompanyName.trim();
  const uiLab = resolveUiLabCompanyName(companyId);
  if (uiLab) return uiLab;
  return "Company";
}
