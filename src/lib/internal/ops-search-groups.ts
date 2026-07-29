/** Group and prioritize internal global search results (Phase 8). */

import type { GlobalSearchResult, GlobalSearchResultType } from "@/lib/internal/ops-types";

export type SearchResultGroupId =
  | "people"
  | "products"
  | "activity"
  | "relationship"
  | "audit";

export type SearchResultGroup = {
  id: SearchResultGroupId;
  label: string;
  results: GlobalSearchResult[];
};

const GROUP_ORDER: SearchResultGroupId[] = [
  "people",
  "products",
  "activity",
  "relationship",
  "audit",
];

const GROUP_LABELS: Record<SearchResultGroupId, string> = {
  people: "People and companies",
  products: "Products and accounts",
  activity: "Activity and transactions",
  relationship: "Relationships",
  audit: "Audit",
};

const TYPE_GROUP: Record<GlobalSearchResultType, SearchResultGroupId> = {
  user: "people",
  company: "people",
  account: "products",
  loan: "products",
  lending_application: "products",
  alta_card: "products",
  alta_card_application: "products",
  alta_card_review: "products",
  alta_card_statement: "products",
  statement: "products",
  terminal_portfolio: "products",
  terminal_order: "products",
  deal_room: "products",
  transaction: "activity",
  deposit: "activity",
  withdrawal: "activity",
  alta_pay: "activity",
  relationship_profile: "relationship",
  company_relationship: "relationship",
  audit: "audit",
  job_run: "audit",
};

export const SEARCH_GROUP_PRIMARY_LIMIT = 4;
export const SEARCH_GROUP_AUDIT_LIMIT = 3;

function isExactMatch(row: GlobalSearchResult, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return false;
  return (
    row.label.toLowerCase() === needle ||
    row.id.toLowerCase() === needle ||
    (row.sublabel?.toLowerCase().includes(needle) === true &&
      row.label.toLowerCase().startsWith(needle))
  );
}

function rankWithinGroup(row: GlobalSearchResult, q: string): number {
  if (isExactMatch(row, q)) return 0;
  if (row.label.toLowerCase().startsWith(q.trim().toLowerCase())) return 1;
  return 2;
}

/** Corporate/Bank priority: people → products → activity → relationship → audit. */
export function groupOpsSearchResults(
  results: GlobalSearchResult[],
  q: string,
): SearchResultGroup[] {
  const buckets = new Map<SearchResultGroupId, GlobalSearchResult[]>();
  for (const id of GROUP_ORDER) buckets.set(id, []);

  const seen = new Set<string>();
  for (const row of results) {
    const key = `${row.type}:${row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const group = TYPE_GROUP[row.type];
    buckets.get(group)!.push(row);
  }

  for (const id of GROUP_ORDER) {
    const list = buckets.get(id)!;
    list.sort((a, b) => {
      const ra = rankWithinGroup(a, q) - rankWithinGroup(b, q);
      if (ra !== 0) return ra;
      return a.label.localeCompare(b.label);
    });
  }

  // Promote exact people matches ahead of other groups by sorting people first always.
  return GROUP_ORDER.map((id) => ({
    id,
    label: GROUP_LABELS[id],
    results: buckets.get(id)!,
  })).filter((g) => g.results.length > 0);
}

export function visibleGroupResults(
  group: SearchResultGroup,
  expanded: boolean,
): { visible: GlobalSearchResult[]; hiddenCount: number } {
  const limit =
    group.id === "audit" ? SEARCH_GROUP_AUDIT_LIMIT : SEARCH_GROUP_PRIMARY_LIMIT;
  if (expanded || group.results.length <= limit) {
    return { visible: group.results, hiddenCount: 0 };
  }
  return {
    visible: group.results.slice(0, limit),
    hiddenCount: group.results.length - limit,
  };
}

/** Terminal: exact order/symbol/portfolio first, then people, then other. */
export function prioritizeTerminalSearchResults(
  results: GlobalSearchResult[],
  q: string,
): GlobalSearchResult[] {
  const score = (row: GlobalSearchResult) => {
    const exact = isExactMatch(row, q) ? 0 : 1;
    if (row.type === "terminal_order" || row.type === "terminal_portfolio") return exact;
    if (row.type === "user" || row.type === "company") return 10 + exact;
    return 20 + exact;
  };
  return [...results].sort((a, b) => score(a) - score(b) || a.label.localeCompare(b.label));
}
