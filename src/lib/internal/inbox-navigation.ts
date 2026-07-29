import type { InboxItem, InboxSearch } from "@/lib/internal/inbox-types";
import {
  normalizeInternalSearch,
  serializeInternalSearch,
} from "@/lib/internal/normalize-internal-search";
import { buildInboxReturnPath } from "@/lib/internal/record-return-context";
import { readDevSiteFromSearch } from "@/lib/site/preserve-dev-site-search";

export function materializeInboxDestination(
  to: string,
  params?: Record<string, string>,
): string {
  if (!params) return to;
  return Object.entries(params).reduce(
    (path, [key, value]) => path.replaceAll(`$${key}`, encodeURIComponent(value)),
    to,
  );
}

export function buildInboxRecordHref(item: InboxItem, inboxSearch?: InboxSearch): string {
  const dest = item.destination;
  const returnFrom = inboxSearch ? buildInboxReturnPath(inboxSearch) : undefined;
  const site =
    (inboxSearch?.site && inboxSearch.site.trim()) ||
    readDevSiteFromSearch(dest.search as Record<string, unknown> | undefined);
  const search = normalizeInternalSearch({
    ...(dest.search ?? {}),
    ...(returnFrom ? { from: returnFrom } : {}),
    ...(site ? { site } : {}),
  });
  const query = serializeInternalSearch(search);
  return `${materializeInboxDestination(dest.to, dest.params)}${query ? `?${query}` : ""}`;
}
