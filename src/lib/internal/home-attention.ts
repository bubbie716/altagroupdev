/** Corporate / Bank Home attention ranking and platform-status selection. */

import type { ActivityFeedItem, OpsHealthItem } from "@/lib/internal/ops-types";
import { formatInboxAge } from "@/lib/internal/inbox-normalize";

export type HomeAttentionItem = {
  id: string;
  label: string;
  count: number;
  to: string;
  search: Record<string, unknown>;
  /** Higher = more urgent for sort. */
  urgency: number;
  tone: "alert" | "warn" | "info" | "neutral";
};

export function rankHomeAttention(items: HomeAttentionItem[]): HomeAttentionItem[] {
  return items
    .filter((i) => i.count > 0)
    .sort((a, b) => b.urgency - a.urgency || b.count - a.count || a.label.localeCompare(b.label));
}

export function homeAttentionTotal(items: HomeAttentionItem[]): number {
  return items.reduce((sum, i) => sum + i.count, 0);
}

/** Statement-related health keys that represent the same capability. */
const STATEMENT_HEALTH_KEYS = new Set(["BANK_ACCOUNT_STATEMENTS", "statements"]);

/** Humanize job/catalog keys into operator-facing title case. */
export function formatHomePlatformSignalLabel(label: string, key: string): string {
  const raw = (label || key || "").trim();
  if (!raw) return "System signal";
  // Prefer a stable plain-language name for statement jobs.
  if (STATEMENT_HEALTH_KEYS.has(key) || /statement/i.test(raw)) {
    return "Bank account statements";
  }
  // Title-case snake/kebab/raw catalog identifiers; keep already-spaced labels.
  if (/^[a-z0-9]+(?:[_-][a-z0-9]+)+$/i.test(raw) || raw === raw.toLowerCase()) {
    return raw
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return raw;
}

function normalizeHomePlatformSignal(item: OpsHealthItem): OpsHealthItem {
  return {
    ...item,
    label: formatHomePlatformSignalLabel(item.label, item.key),
  };
}

/**
 * Collapse duplicate statement signals into one authoritative item.
 * Prefer degraded/unknown over healthy; prefer BANK_ACCOUNT_STATEMENTS key.
 */
export function dedupeHomePlatformSignals(health: OpsHealthItem[]): OpsHealthItem[] {
  const statements = health.filter((h) => STATEMENT_HEALTH_KEYS.has(h.key));
  const others = health.filter((h) => !STATEMENT_HEALTH_KEYS.has(h.key));
  if (statements.length === 0) return health.map(normalizeHomePlatformSignal);

  const rank = (s: OpsHealthItem["status"]) =>
    s === "degraded" ? 0 : s === "unknown" ? 1 : 2;
  const preferred = [...statements].sort((a, b) => {
    const sr = rank(a.status) - rank(b.status);
    if (sr !== 0) return sr;
    if (a.key === "BANK_ACCOUNT_STATEMENTS" && b.key !== "BANK_ACCOUNT_STATEMENTS") return -1;
    if (b.key === "BANK_ACCOUNT_STATEMENTS" && a.key !== "BANK_ACCOUNT_STATEMENTS") return 1;
    return a.label.localeCompare(b.label);
  })[0]!;

  return [...others, preferred].map(normalizeHomePlatformSignal);
}

/** Pick at most four operator-relevant platform signals; unhealthy first. */
export function selectHomePlatformStatus(health: OpsHealthItem[]): OpsHealthItem[] {
  const deduped = dedupeHomePlatformSignals(health);
  const byKey = new Map(deduped.map((h) => [h.key, h]));
  const preferredKeys = [
    "maintenance",
    "scheduled_transfers",
    "BANK_ACCOUNT_STATEMENTS",
    "statements",
    "deposit_interest",
    "loan_servicing",
    "platform",
  ];

  const picked: OpsHealthItem[] = [];
  const seen = new Set<string>();
  const seenStatement = { value: false };

  const unhealthy = deduped
    .filter((h) => h.status === "degraded" || h.status === "unknown")
    .sort((a, b) => {
      const rank = (s: OpsHealthItem["status"]) => (s === "degraded" ? 0 : 1);
      return rank(a.status) - rank(b.status) || a.label.localeCompare(b.label);
    });
  for (const h of unhealthy) {
    if (picked.length >= 4) break;
    if (STATEMENT_HEALTH_KEYS.has(h.key)) {
      if (seenStatement.value) continue;
      seenStatement.value = true;
    }
    picked.push(h);
    seen.add(h.key);
  }

  for (const key of preferredKeys) {
    if (picked.length >= 4) break;
    const h = byKey.get(key);
    if (!h || seen.has(h.key)) continue;
    if (STATEMENT_HEALTH_KEYS.has(h.key)) {
      if (seenStatement.value) continue;
      seenStatement.value = true;
    }
    picked.push(h);
    seen.add(h.key);
  }

  return picked.slice(0, 4);
}

export function summarizeHealthyJobs(health: OpsHealthItem[]): string | null {
  const ok = health.filter((h) => h.status === "operational" && h.key !== "maintenance");
  if (ok.length === 0) return null;
  const latest = ok
    .map((h) => h.lastSuccessAt)
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1);
  if (!latest) return `${ok.length} routine jobs healthy`;
  const ageMs = Math.max(0, Date.now() - Date.parse(latest));
  return `Routine jobs healthy · last success ${formatInboxAge(ageMs)} ago`;
}

export function formatHomeRelativeTime(iso: string, now = Date.now()): string {
  const ageMs = Math.max(0, now - Date.parse(iso));
  if (!Number.isFinite(ageMs)) return "—";
  if (ageMs < 60_000) return "Just now";
  return `${formatInboxAge(ageMs)} ago`;
}

/** Cap and lightly dedupe Corporate Home activity for a compact list. */
export function selectHomeRecentActivity(
  activity: ActivityFeedItem[],
  limit = 6,
): ActivityFeedItem[] {
  const STAFF_ALERT_TITLE = "Staff alert delivery failed";
  const staffAlerts = activity.filter((i) => i.title === STAFF_ALERT_TITLE);
  const others = activity.filter((i) => i.title !== STAFF_ALERT_TITLE);

  let collapsedStaff: ActivityFeedItem | null = null;
  if (staffAlerts.length > 1) {
    const newest = [...staffAlerts].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]!;
    collapsedStaff = {
      id: `staff-alert-cluster:${newest.id}`,
      category: "audit",
      title: `${staffAlerts.length} staff alerts were not delivered`,
      detail: "Repeated delivery failures — open the audit log for details.",
      accountLabel: null,
      accountId: null,
      href: "/internal/audit",
      search: { action: "STAFF_AUDIT_MESSAGE_FAILED", view: "all" },
      actorLabel: null,
      createdAt: newest.createdAt,
    };
  } else if (staffAlerts.length === 1) {
    collapsedStaff = staffAlerts[0]!;
  }

  const merged = collapsedStaff
    ? [collapsedStaff, ...others].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : others;

  const seenTitles = new Map<string, number>();
  const out: ActivityFeedItem[] = [];
  for (const item of merged) {
    const key = `${item.title}|${item.actorLabel ?? ""}`;
    const prior = seenTitles.get(key) ?? 0;
    if (prior >= 2) continue;
    seenTitles.set(key, prior + 1);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}
