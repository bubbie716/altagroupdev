/**
 * Activity center URL contract.
 *
 *   /bank/activity?view=activity|requests|scheduled|autopay
 *   /bank/activity?view=requests&requestId=…
 *   /bank/activity?view=activity&transactionId=…
 *   /bank/activity?view=scheduled&scheduleId=…
 *   /bank/activity?view=autopay&approvalId=…
 *   /bank/activity?view=scheduled&accountId=…  (filter lock)
 */

export const BANK_ACTIVITY_VIEWS = ["activity", "requests", "scheduled", "autopay"] as const;

export type BankActivityView = (typeof BANK_ACTIVITY_VIEWS)[number];

export type BankActivityCenterSearch = {
  view: BankActivityView;
  accountId?: string;
  transactionId?: string;
  requestId?: string;
  scheduleId?: string;
  approvalId?: string;
};

const DETAIL_KEYS = ["transactionId", "requestId", "scheduleId", "approvalId"] as const;

export function parseBankActivityView(value: unknown): BankActivityView {
  if (value === "requests" || value === "scheduled" || value === "autopay") return value;
  return "activity";
}

export function parseBankActivityCenterSearch(
  search: Record<string, unknown> | string | null | undefined,
): BankActivityCenterSearch {
  const params =
    typeof search === "string"
      ? Object.fromEntries(new URLSearchParams(search.startsWith("?") ? search.slice(1) : search))
      : (search ?? {});

  const result: BankActivityCenterSearch = {
    view: parseBankActivityView(params.view),
  };

  if (typeof params.accountId === "string" && params.accountId.trim()) {
    result.accountId = params.accountId.trim();
  }
  if (typeof params.transactionId === "string" && params.transactionId.trim()) {
    result.transactionId = params.transactionId.trim();
  }
  if (typeof params.requestId === "string" && params.requestId.trim()) {
    result.requestId = params.requestId.trim();
  }
  if (typeof params.scheduleId === "string" && params.scheduleId.trim()) {
    result.scheduleId = params.scheduleId.trim();
  }
  if (typeof params.approvalId === "string" && params.approvalId.trim()) {
    result.approvalId = params.approvalId.trim();
  }

  return result;
}

/** Drop only the selected-record param; keep view and unrelated filters. */
export function stripBankActivityDetailSearch<T extends Record<string, unknown>>(
  search: T,
): Record<string, unknown> {
  const next = { ...search } as Record<string, unknown>;
  for (const key of DETAIL_KEYS) {
    delete next[key];
  }
  return next;
}

export function mergeBankActivityCenterSearch(
  current: Record<string, unknown>,
  patch: Partial<BankActivityCenterSearch> & { view?: BankActivityView },
): Record<string, unknown> {
  const next = { ...current };
  if (patch.view) next.view = patch.view;
  if (patch.accountId) next.accountId = patch.accountId;
  else if ("accountId" in patch) delete next.accountId;

  for (const key of DETAIL_KEYS) {
    const value = patch[key];
    if (typeof value === "string" && value) next[key] = value;
    else if (key in patch) delete next[key];
  }

  return next;
}

export function activityRequestsHref(requestId: string): string {
  return `/bank/activity?view=requests&requestId=${encodeURIComponent(requestId)}`;
}

export function activityTransactionHref(transactionId: string): string {
  return `/bank/activity?view=activity&transactionId=${encodeURIComponent(transactionId)}`;
}

export function activityScheduledHref(opts?: {
  scheduleId?: string;
  accountId?: string;
}): string {
  const params = new URLSearchParams({ view: "scheduled" });
  if (opts?.scheduleId) params.set("scheduleId", opts.scheduleId);
  if (opts?.accountId) params.set("accountId", opts.accountId);
  return `/bank/activity?${params.toString()}`;
}

export function activityAutopayHref(approvalId?: string): string {
  const params = new URLSearchParams({ view: "autopay" });
  if (approvalId) params.set("approvalId", approvalId);
  return `/bank/activity?${params.toString()}`;
}
