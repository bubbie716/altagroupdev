import { isSafeInternalFrom } from "@/lib/internal/record-workspace-search";
import { inboxSearchToParams, type InboxSearch } from "@/lib/internal/inbox-types";

/** Build a safe `from` path for returning to Inbox with current filters. */
export function buildInboxReturnPath(search: InboxSearch): string {
  const params = inboxSearchToParams(search);
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) qs.set(key, value);
  }
  const q = qs.toString();
  return q ? `/internal/inbox?${q}` : "/internal/inbox";
}

export function parseReturnPath(from: string | undefined | null): {
  pathname: string;
  search: Record<string, string>;
  label: string;
} | null {
  if (!isSafeInternalFrom(from)) return null;
  try {
    const url = new URL(from, "https://alta.local");
    const search: Record<string, string> = {};
    url.searchParams.forEach((v, k) => {
      search[k] = v;
    });
    const pathname = url.pathname;
    let label = "Back";
    if (pathname === "/internal/inbox" || pathname.startsWith("/internal/inbox/")) {
      label = "Inbox";
    } else if (pathname.startsWith("/internal/users")) {
      label = "Customers";
    } else if (pathname.startsWith("/internal/companies")) {
      label = "Companies";
    } else if (pathname.startsWith("/internal/bank/accounts")) {
      label = "Accounts";
    } else if (pathname.startsWith("/internal/bank/transactions")) {
      label = "Transactions";
    } else if (pathname.startsWith("/internal/bank/transfers")) {
      label = "Transfers";
    } else if (pathname.startsWith("/internal/bank/scheduled")) {
      label = "Transfers";
    } else if (pathname.startsWith("/internal/bank/alta-pay")) {
      label = "Alta Pay";
    } else if (pathname.startsWith("/internal/bank/interest")) {
      label = "Interest";
    } else if (pathname.startsWith("/internal/bank/statements")) {
      label = "Statements";
    } else if (pathname.startsWith("/internal/alta-card")) {
      label = "Alta Card";
    } else if (pathname.startsWith("/internal/lending")) {
      label = "Lending";
    } else if (pathname.startsWith("/internal/inbox")) {
      label = "Inbox";
    } else if (pathname.startsWith("/internal/")) {
      const seg = pathname.split("/").filter(Boolean)[1];
      label = seg ? seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "Internal";
    }
    return { pathname, search, label };
  } catch {
    return null;
  }
}
