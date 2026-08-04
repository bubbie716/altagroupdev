import { createServerFn } from "@tanstack/react-start";
import {
  buildInboxSummary,
  dedupeInboxItems,
  filterAndSortInboxItems,
  inboxItemFromAccountOpening,
  inboxItemFromCardApp,
  inboxItemFromCardReview,
  inboxItemFromCompany,
  inboxItemFromDealRoomCardApp,
  inboxItemFromDealRoomCardReview,
  inboxItemFromDealRoomLending,
  inboxItemFromDeposit,
  inboxItemFromException,
  inboxItemFromLendingApp,
  inboxItemFromWithdrawal,
} from "@/lib/internal/inbox-normalize";
import {
  parseInboxSearch,
  type InboxItem,
  type InboxPayload,
  type InboxSearch,
} from "@/lib/internal/inbox-types";

export type { InboxPayload };

async function loadInboxSources() {
  const [
    { fetchPendingDepositsQueue, fetchPendingWithdrawalsQueue, fetchPendingAccountOpeningsQueue },
    { fetchInternalCompaniesFromDb },
    { fetchInternalLendingOps },
    { fetchInternalAltaCardApplicationsFiltered },
    { fetchInternalAltaCardReviewQueue },
    { fetchExceptionCenter },
  ] = await Promise.all([
    import("@/lib/bank/bank.functions"),
    import("@/lib/company/company.functions"),
    import("@/lib/bank/lending.functions"),
    import("@/lib/bank/alta-card-application.functions"),
    import("@/lib/bank/alta-card-review.functions"),
    import("@/lib/internal/ops-platform.functions"),
  ]);

  const sourceErrors: string[] = [];
  async function safeLoad<T>(label: string, load: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await load();
    } catch {
      sourceErrors.push(label);
      return fallback;
    }
  }

  const [deposits, withdrawals, openings, companies, lendingOps, cardApps, cardReviews, exceptions] =
    await Promise.all([
      safeLoad("deposits", () => fetchPendingDepositsQueue(), []),
      safeLoad("withdrawals", () => fetchPendingWithdrawalsQueue(), []),
      safeLoad("account openings", () => fetchPendingAccountOpeningsQueue(), []),
      safeLoad("companies", () => fetchInternalCompaniesFromDb(), []),
      safeLoad("lending", () => fetchInternalLendingOps(), {
        applications: [] as never[],
        activeLoans: [] as never[],
        paidOffLoans: [] as never[],
        frozenLoans: [] as never[],
        defaultedLoans: [] as never[],
      }),
      safeLoad("card applications", () => fetchInternalAltaCardApplicationsFiltered({ data: {} }), []),
      safeLoad("card reviews", () => fetchInternalAltaCardReviewQueue(), []),
      safeLoad("risk", () => fetchExceptionCenter(), []),
    ]);

  return {
    deposits,
    withdrawals,
    openings,
    companies,
    applications: lendingOps.applications ?? [],
    cardApps,
    cardReviews,
    exceptions,
    sourceErrors,
  };
}

function assembleInboxItems(sources: Awaited<ReturnType<typeof loadInboxSources>>): InboxItem[] {
  const items: InboxItem[] = [];

  for (const row of sources.deposits) items.push(inboxItemFromDeposit(row));
  for (const row of sources.withdrawals) items.push(inboxItemFromWithdrawal(row));
  for (const row of sources.openings) items.push(inboxItemFromAccountOpening(row));
  for (const row of sources.companies) {
    const item = inboxItemFromCompany(row);
    if (item) items.push(item);
  }
  for (const row of sources.applications) {
    const item = inboxItemFromLendingApp(row);
    if (item) items.push(item);
  }
  for (const row of sources.cardApps) {
    const item = inboxItemFromCardApp(row);
    if (item) items.push(item);
  }
  for (const row of sources.cardReviews) {
    const item = inboxItemFromCardReview(row);
    if (item) items.push(item);
  }
  for (const row of sources.exceptions) {
    const item = inboxItemFromException(row);
    if (item) items.push(item);
  }

  // Deal-room variants — included only when filtering by type=deal_room
  for (const row of sources.applications) {
    const item = inboxItemFromDealRoomLending(row);
    if (item) items.push(item);
  }
  for (const row of sources.cardApps) {
    const item = inboxItemFromDealRoomCardApp(row);
    if (item) items.push(item);
  }
  for (const row of sources.cardReviews) {
    const item = inboxItemFromDealRoomCardReview(row);
    if (item) items.push(item);
  }

  return dedupeInboxItems(items);
}

/** Server-side Inbox aggregation — one round-trip, normalized items. */
export const fetchInternalInbox = createServerFn({ method: "GET" })
  .inputValidator((input: { search?: Record<string, unknown> } | undefined) => input ?? {})
  .handler(async ({ data }): Promise<InboxPayload> => {
    const search = parseInboxSearch(data.search ?? {});
    const sources = await loadInboxSources();
    let items = assembleInboxItems(sources);

    // Hide deal-room duplicates unless explicitly filtering that type.
    if (search.type !== "deal_room") {
      items = items.filter((i) => i.caseType !== "deal_room");
    } else {
      items = items.filter((i) => i.caseType === "deal_room");
    }

    const summary = buildInboxSummary(
      search.type === "deal_room"
        ? items
        : assembleInboxItems(sources).filter((i) => i.caseType !== "deal_room"),
    );
    const filtered = filterAndSortInboxItems(items, search);
    return { items, filtered, summary, search, sourceErrors: sources.sourceErrors };
  });
