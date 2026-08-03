/**
 * Admin Copilot tool registry — allowlisted read-only tools.
 * Reuses globalOpsSearch + presentation-safe summaries. No mutations. No arbitrary SQL.
 */
import type { GlobalSearchResult, GlobalSearchResultType } from "@/lib/internal/ops-types";
import type {
  AdminCopilotEntityMatch,
  AdminCopilotEntityType,
  AdminCopilotToolId,
  AdminCopilotToolResult,
} from "@/lib/internal/copilot/types";
import { ADMIN_COPILOT_MAX_TOOL_RESULTS } from "@/lib/internal/copilot/types";
import { sanitizeUntrustedRecordText } from "@/lib/internal/copilot/prompt-safety";
import { aliasesMatch, normalizeEntityAlias } from "@/lib/internal/copilot/entity-resolution";
import {
  canonicalizeDealRoomHref,
  createSafeNavigationIntent,
} from "@/lib/internal/copilot/navigation-safety";
import type { AdminCopilotNavigationIntent } from "@/lib/internal/copilot/types";
import { globalOpsSearch } from "@/server/ops-global-search.service";

function mapEntityType(type: GlobalSearchResultType): AdminCopilotEntityType {
  switch (type) {
    case "user":
      return "user";
    case "company":
      return "company";
    case "account":
      return "account";
    case "transaction":
    case "deposit":
    case "withdrawal":
      return "transaction";
    case "loan":
      return "loan";
    case "lending_application":
      return "lending_application";
    case "deal_room":
      return "deal_room";
    case "alta_card":
      return "alta_card";
    case "alta_card_application":
    case "alta_card_review":
      return "alta_card_application";
    case "terminal_portfolio":
      return "terminal_portfolio";
    case "terminal_order":
      return "terminal_order";
    case "audit":
      return "audit";
    case "job_run":
      return "job";
    default:
      return "unknown";
  }
}

function toMatch(row: GlobalSearchResult): AdminCopilotEntityMatch {
  const href =
    row.type === "deal_room" || row.type === "lending_application"
      ? canonicalizeDealRoomHref(row.href)
      : row.href;
  return {
    entityType: mapEntityType(row.type),
    entityId: row.id,
    label: sanitizeUntrustedRecordText(row.label, 120),
    sublabel: sanitizeUntrustedRecordText(
      [row.sublabel, row.amount].filter(Boolean).join(" · "),
      180,
    ),
    status: row.status,
    updatedAt: row.date,
    href,
  };
}

function clampLimit(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return ADMIN_COPILOT_MAX_TOOL_RESULTS;
  return Math.max(1, Math.min(ADMIN_COPILOT_MAX_TOOL_RESULTS, Math.floor(n)));
}

function filterByTypes(
  rows: GlobalSearchResult[],
  types: GlobalSearchResultType[],
  limit: number,
): AdminCopilotEntityMatch[] {
  return rows
    .filter((r) => types.includes(r.type))
    .slice(0, limit)
    .map(toMatch);
}

function dedupeMatchesLocal(matches: AdminCopilotEntityMatch[]): AdminCopilotEntityMatch[] {
  const seen = new Set<string>();
  const out: AdminCopilotEntityMatch[] = [];
  for (const m of matches) {
    const key = `${m.entityType}:${m.entityId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

export type AdminCopilotToolContext = {
  siteKey: string;
  from?: string;
  operatorUserId?: string;
  /** Accumulated matches from prior tools in the same turn. */
  matches: AdminCopilotEntityMatch[];
};

export type AdminCopilotToolOutput = {
  matches?: AdminCopilotEntityMatch[];
  summary?: string;
  /** Straight headline for the operator (e.g. total balance). */
  answer?: string;
  navigation?: AdminCopilotNavigationIntent | null;
  denied?: boolean;
};

async function searchTyped(
  q: string,
  siteKey: string,
  types: GlobalSearchResultType[],
  limit: number,
): Promise<AdminCopilotEntityMatch[]> {
  const rows = await globalOpsSearch(String(q ?? "").trim(), Math.min(24, Math.max(limit * 2, 8)), siteKey);
  return filterByTypes(rows, types, limit);
}

function serializeForModel(out: AdminCopilotToolOutput): string {
  const matches = (out.matches ?? []).slice(0, ADMIN_COPILOT_MAX_TOOL_RESULTS).map((m) => ({
    type: m.entityType,
    id: m.entityId,
    label: m.label,
    sub: m.sublabel || undefined,
    status: m.status || undefined,
  }));
  return JSON.stringify({
    ok: !out.denied,
    denied: out.denied || undefined,
    answer: out.answer ? sanitizeUntrustedRecordText(out.answer, 80) : undefined,
    summary: out.summary ? sanitizeUntrustedRecordText(out.summary, 180) : undefined,
    n: matches.length,
    matches,
  });
}

export async function executeAllowlistedCopilotTool(
  tool: AdminCopilotToolId,
  args: Record<string, unknown>,
  ctx: AdminCopilotToolContext,
  callId?: string,
): Promise<AdminCopilotToolResult> {
  const handler = AdminCopilotToolRegistry[tool];
  if (!handler) {
    return {
      callId,
      tool,
      ok: false,
      content: JSON.stringify({ ok: false, error: "Unknown tool" }),
    };
  }
  try {
    const out = await handler(args, ctx);
    return {
      callId,
      tool,
      ok: !out.denied,
      content: serializeForModel(out),
      matches: out.matches,
      navigation: out.navigation,
      denied: out.denied,
      answer: out.answer,
    };
  } catch {
    // Do not leak stack traces / Prisma errors to the model or UI.
    return {
      callId,
      tool,
      ok: false,
      content: JSON.stringify({ ok: false, error: "Tool failed." }),
    };
  }
}

export const AdminCopilotToolRegistry: Record<
  AdminCopilotToolId,
  (args: Record<string, unknown>, ctx: AdminCopilotToolContext) => Promise<AdminCopilotToolOutput>
> = {
  async searchPeople(args, ctx) {
    const limit = clampLimit(args.limit);
    const matches = await searchTyped(String(args.q ?? ""), ctx.siteKey, ["user"], limit);
    return { matches };
  },
  async searchCompanies(args, ctx) {
    const limit = clampLimit(args.limit);
    const matches = await searchTyped(String(args.q ?? ""), ctx.siteKey, ["company"], limit);
    return { matches };
  },
  async searchAccounts(args, ctx) {
    const limit = clampLimit(args.limit);
    const matches = await searchTyped(String(args.q ?? ""), ctx.siteKey, ["account"], limit);
    return { matches };
  },
  async searchTransactions(args, ctx) {
    const limit = clampLimit(args.limit);
    const matches = await searchTyped(String(args.q ?? ""), ctx.siteKey, [
      "transaction",
      "deposit",
      "withdrawal",
    ], limit);
    return { matches };
  },
  async searchTransfers(args, ctx) {
    const limit = clampLimit(args.limit);
    const matches = await searchTyped(String(args.q ?? ""), ctx.siteKey, [
      "transaction",
      "alta_pay",
    ], limit);
    const sorted = args.latest
      ? [...matches].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
      : matches;
    return { matches: sorted.slice(0, args.latest ? Math.min(3, limit) : limit) };
  },
  async searchTerminalInvestors(args, ctx) {
    const limit = clampLimit(args.limit);
    const matches = await searchTyped(String(args.q ?? ""), "terminal", ["user"], limit);
    return { matches };
  },
  async searchTerminalPortfolios(args, ctx) {
    const limit = clampLimit(args.limit);
    const matches = await searchTyped(String(args.q ?? ""), "terminal", ["terminal_portfolio"], limit);
    return { matches };
  },
  async searchTerminalOrders(args, ctx) {
    const limit = clampLimit(args.limit);
    let matches = await searchTyped(String(args.q ?? ""), "terminal", ["terminal_order"], limit);
    if (args.statusHint) {
      const hint = String(args.statusHint).toLowerCase();
      matches = matches.filter((m) => (m.status ?? "").toLowerCase().includes(hint));
    }
    return { matches: matches.slice(0, limit) };
  },
  async searchCryptoOrders(args, ctx) {
    const limit = clampLimit(args.limit);
    const matches = await searchTyped(String(args.q ?? ""), "terminal", [
      "terminal_order",
      "terminal_crypto_market",
    ], limit);
    return { matches };
  },
  async searchLoans(args, ctx) {
    const limit = clampLimit(args.limit);
    let matches = await searchTyped(String(args.q ?? ""), ctx.siteKey, ["loan"], limit);
    if (args.statusHint) {
      const hint = String(args.statusHint).toUpperCase();
      matches = matches.filter((m) => (m.status ?? "").toUpperCase().includes(hint));
    }
    return { matches: matches.slice(0, limit) };
  },
  async searchLendingApplications(args, ctx) {
    const limit = clampLimit(args.limit);
    let matches = await searchTyped(
      String(args.q ?? ""),
      ctx.siteKey,
      ["lending_application"],
      limit,
    );
    if (args.statusHint) {
      const hint = String(args.statusHint).toLowerCase();
      matches = matches.filter(
        (m) =>
          (m.status ?? "").toLowerCase().includes(hint) ||
          (m.sublabel ?? "").toLowerCase().includes(hint),
      );
    }
    return { matches: matches.slice(0, limit) };
  },
  async searchDealRooms(args, ctx) {
    const limit = clampLimit(args.limit);
    const q = String(args.q ?? "");
    const rows = await globalOpsSearch(q, 24, ctx.siteKey);
    let matches = filterByTypes(rows, ["deal_room", "lending_application"], limit * 2).map((m) => ({
      ...m,
      href: canonicalizeDealRoomHref(m.href),
      entityType: m.entityType === "lending_application" ? ("deal_room" as const) : m.entityType,
    }));

    const people = ctx.matches.filter((m) => m.entityType === "user");
    if (people.length === 1) {
      const alias = normalizeEntityAlias(people[0]!.label);
      const related = matches.filter(
        (m) =>
          aliasesMatch(m.label, alias) ||
          aliasesMatch(m.sublabel, alias) ||
          aliasesMatch(m.label, q),
      );
      if (related.length) matches = related;
    }

    if (args.preferActive) {
      matches = [...matches].sort((a, b) => {
        const aPend = /pending|active|review|underwriting/i.test(a.status ?? a.sublabel ?? "")
          ? 0
          : 1;
        const bPend = /pending|active|review|underwriting/i.test(b.status ?? b.sublabel ?? "")
          ? 0
          : 1;
        if (aPend !== bPend) return aPend - bPend;
        return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
      });
    }

    return { matches: matches.slice(0, limit) };
  },
  async searchAltaCards(args, ctx) {
    const limit = clampLimit(args.limit);
    const matches = await searchTyped(String(args.q ?? ""), ctx.siteKey, ["alta_card"], limit);
    return { matches };
  },
  async searchAltaCardApplications(args, ctx) {
    const limit = clampLimit(args.limit);
    const matches = await searchTyped(String(args.q ?? ""), ctx.siteKey, [
      "alta_card_application",
      "alta_card_review",
    ], limit);
    return { matches };
  },
  async getCustomerSummary(args, ctx) {
    const q = String(args.q ?? args.userId ?? "").trim();
    const people = await searchTyped(q, ctx.siteKey, ["user"], 3);
    if (!people.length) return { matches: [], summary: "No authorized customer matched." };
    const person = people[0]!;
    // Resolve accounts via person label / id so username lookups work.
    const accountQuery = person.label || q;
    const accounts = await searchTyped(accountQuery, ctx.siteKey, ["account"], ADMIN_COPILOT_MAX_TOOL_RESULTS);
    // Prefer accounts whose sublabel mentions this person when multiple people matched earlier.
    const linked = accounts.filter(
      (a) =>
        aliasesMatch(a.sublabel, person.label) ||
        aliasesMatch(a.label, person.label) ||
        aliasesMatch(a.sublabel, q),
    );
    const accountMatches = linked.length ? linked : accounts;

    const amounts = accountMatches
      .map((a) => {
        const raw = a.sublabel?.match(/ƒ[\d,]+(?:\.\d+)?/)?.[0] ?? null;
        if (!raw) return null;
        const n = Number(raw.replace(/[ƒ,]/g, ""));
        return Number.isFinite(n) ? n : null;
      })
      .filter((n): n is number => n != null);

    const total = amounts.reduce((s, n) => s + n, 0);
    const answer =
      amounts.length > 0
        ? `ƒ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : undefined;

    const summary = answer
      ? `${person.label}'s total Alta Bank ledger balance is ${answer} across ${amounts.length} authorized account${amounts.length === 1 ? "" : "s"}. Open the customer or account sources below.`
      : `${person.label} — ${person.sublabel ?? "customer"}. No authorized bank accounts found. Open the customer workspace for full detail.`;

    return {
      matches: dedupeMatchesLocal([person, ...accountMatches]),
      answer,
      summary,
    };
  },
  async getCompanySummary(args, ctx) {
    const matches = await searchTyped(
      String(args.q ?? args.companyId ?? ""),
      ctx.siteKey,
      ["company"],
      3,
    );
    if (!matches.length) return { matches: [], summary: "No authorized company matched." };
    const m = matches[0]!;
    return {
      matches: [m],
      summary: `${m.label} — ${m.sublabel ?? "company"}. Open the company workspace for full detail.`,
    };
  },
  async getDiscordOpsSummary() {
    return {
      summary:
        "Open Internal → customer workspace Discord operations for outbox health, dead-letter rows, and role sync. Copilot does not expose raw delivery payloads.",
      matches: [
        {
          entityType: "discord_ops",
          entityId: "discord-ops",
          label: "Discord operations",
          sublabel: "Outbox · role sync · dead letters",
          href: "/internal/jobs",
        },
      ],
    };
  },
  async getAuditSummary(args, ctx) {
    const matches = await searchTyped(
      String(args.focus === "failures" ? "audit fail" : "audit"),
      ctx.siteKey,
      ["audit"],
      clampLimit(args.limit),
    );
    return {
      matches,
      summary: matches.length
        ? `Found ${matches.length} recent audit hits.`
        : "No matching audit rows in search scope.",
    };
  },
  async getJobHealth(args, ctx) {
    const matches = await searchTyped("job", ctx.siteKey, ["job_run"], clampLimit(args.limit));
    return {
      matches,
      summary: matches.length
        ? `Job health search returned ${matches.length} run(s).`
        : "Open System → Jobs for live health. No matching job runs in search.",
    };
  },
  async createSafeNavigationIntent(args, ctx) {
    const prefer = String(args.prefer ?? "deal_room");
    const entityId = typeof args.entityId === "string" ? args.entityId : undefined;
    const poolBase =
      prefer === "user"
        ? ctx.matches.filter((m) => m.entityType === "user")
        : prefer === "deal_room"
          ? ctx.matches.filter(
              (m) => m.entityType === "deal_room" || m.entityType === "lending_application",
            )
          : prefer === "company"
            ? ctx.matches.filter((m) => m.entityType === "company")
            : prefer === "account"
              ? ctx.matches.filter((m) => m.entityType === "account")
              : prefer === "loan"
                ? ctx.matches.filter((m) => m.entityType === "loan")
                : prefer === "transaction"
                  ? ctx.matches.filter(
                      (m) => m.entityType === "transaction" || m.entityType === "transfer",
                    )
                  : prefer === "terminal_portfolio"
                    ? ctx.matches.filter((m) => m.entityType === "terminal_portfolio")
                    : prefer === "terminal_order"
                      ? ctx.matches.filter((m) => m.entityType === "terminal_order")
                      : prefer === "alta_card"
                        ? ctx.matches.filter((m) => m.entityType === "alta_card")
                        : ctx.matches;

    const pool = entityId ? poolBase.filter((m) => m.entityId === entityId) : poolBase;

    if (pool.length === 0) {
      return { matches: [], navigation: null };
    }
    if (pool.length > 1) {
      return { matches: pool.slice(0, ADMIN_COPILOT_MAX_TOOL_RESULTS), navigation: null };
    }

    const target = pool[0]!;
    const href =
      prefer === "deal_room"
        ? canonicalizeDealRoomHref(
            target.href.includes("section=")
              ? target.href
              : target.href.replace(/\/thread\/?$/, "") + "?section=evidence",
          )
        : target.href;

    const navigation = createSafeNavigationIntent({
      href,
      siteKey: ctx.siteKey,
      reason: `Open ${target.label}`,
      entityType: target.entityType,
      entityId: target.entityId,
      from: ctx.from,
      section: prefer === "deal_room" ? "evidence" : undefined,
    });

    return { matches: [target], navigation };
  },
};

export function isAllowlistedCopilotTool(id: string): id is AdminCopilotToolId {
  return id in AdminCopilotToolRegistry;
}
