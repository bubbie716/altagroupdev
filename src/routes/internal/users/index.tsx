import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  INTERNAL_USER_WORKSPACE_SEARCH,
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { StatusBadge } from "@/components/internal/status-badge";
import { InternalUserFilters } from "@/components/internal/internal-user-filters";
import { OpsSection, OpsStatStrip } from "@/components/internal/console";
import { buildBreadcrumbs } from "@/components/internal/console/internal-breadcrumbs";
import type { AccountStatus, UserTag } from "@/lib/auth/types";
import { fetchInternalUsers } from "@/lib/internal/user-management.functions";
import type { InternalUserListRow } from "@/lib/internal/user-management.types";
import {
  customerNeedsDirectoryAttention,
  customerProductSummary,
  customerSecondaryId,
  customerStandingLabel,
  sortCustomersForDirectory,
} from "@/lib/internal/directory-desk";
import { buildListReturnPath } from "@/lib/internal/record-workspace-search";
import { cn } from "@/lib/utils";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export type InternalUsersSearch = {
  q?: string;
  discordId?: string;
  tag?: UserTag;
  accountStatus?: AccountStatus;
  attention?: string;
  site?: string;
};

export const Route = createFileRoute("/internal/users/")({
  validateSearch: (search: Record<string, unknown>): InternalUsersSearch => ({
    q: typeof search.q === "string" && search.q.trim() ? search.q.trim() : undefined,
    discordId:
      typeof search.discordId === "string" && search.discordId.trim()
        ? search.discordId.trim()
        : undefined,
    tag:
      search.tag === "corporate_admin" ||
      search.tag === "bank_admin" ||
      search.tag === "terminal_admin"
        ? search.tag
        : undefined,
    accountStatus:
      search.accountStatus === "active" ||
      search.accountStatus === "restricted" ||
      search.accountStatus === "frozen" ||
      search.accountStatus === "pending_review"
        ? search.accountStatus
        : undefined,
    attention: search.attention === "1" ? "1" : undefined,
    site: typeof search.site === "string" && search.site.trim() ? search.site.trim() : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => fetchInternalUsers({ data: deps }),
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Customers", (match.search as { site?: string }).site) }] }),
  component: InternalUsers,
});

function InternalUsers() {
  const users = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const attentionOnly = search.attention === "1";
  const sorted = sortCustomersForDirectory(users, attentionOnly);
  const includeTerminal = search.site !== "bank";
  const returnFrom = buildListReturnPath("/internal/users", {
    q: search.q,
    discordId: search.discordId,
    tag: search.tag,
    accountStatus: search.accountStatus,
    attention: search.attention,
    site: search.site,
  });

  function recordSearch() {
    return {
      ...withInternalSiteSearch(INTERNAL_USER_WORKSPACE_SEARCH, search.site),
      from: returnFrom,
    };
  }

  return (
    <InternalPageShell
      title="People"
      breadcrumbs={buildBreadcrumbs([
        { label: "Home", to: "/internal", search: withInternalSiteSearch({}, search.site) },
        { label: "People" },
      ])}
    >
      <OpsStatStrip
        stats={[
          { label: "Shown", value: sorted.length.toLocaleString() + (users.length >= 200 ? "+" : "") },
          {
            label: "Needs attention",
            value: users.filter(customerNeedsDirectoryAttention).length,
            tone: "warn",
          },
          {
            label: "Frozen",
            value: users.filter((u) => u.accountStatus === "frozen").length,
            tone: "alert",
          },
        ]}
      />

      <InternalUserFilters
        search={search}
        onAttentionChange={(attention) => {
          void navigate({
            to: "/internal/users",
            search: withInternalSiteSearch({ ...search, attention }, search.site),
            replace: true,
          });
        }}
      />

      <OpsSection title={`People · ${sorted.length}${users.length >= 200 ? "+" : ""}`}>
        {sorted.length === 0 ? (
          <p className="px-1 py-6 text-center text-[13px] text-muted-foreground">
            {attentionOnly
              ? "No customers currently need attention."
              : "No customers match the current filters."}
          </p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[40rem] border-collapse text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Customer</th>
                    <th className="px-2 py-2 font-medium">Standing</th>
                    <th className="px-2 py-2 font-medium">Products / relationships</th>
                    <th className="px-2 py-2 font-medium">Last activity</th>
                    <th className="px-2 py-2 font-medium">Needs attention</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((u) => {
                    const secondary = customerSecondaryId(u);
                    const attention = customerNeedsDirectoryAttention(u);
                    return (
                      <tr key={`desktop-${u.id}`} className="border-b border-border/40 hover:bg-surface-1/40">
                        <td className="px-2 py-2.5">
                          <Link
                            to="/internal/users/$userId"
                            params={{ userId: u.id }}
                            search={recordSearch()}
                            className="font-medium hover:text-gold"
                          >
                            {u.discordUsername}
                          </Link>
                          {secondary ? (
                            <div className="text-[11px] text-muted-foreground">{secondary}</div>
                          ) : null}
                        </td>
                        <td className="px-2 py-2.5">
                          <StatusBadge status={customerStandingLabel(u.accountStatus)} />
                        </td>
                        <td className="px-2 py-2.5 text-muted-foreground">
                          {customerProductSummary(u, { includeTerminal })}
                        </td>
                        <td className="px-2 py-2.5 font-mono text-[11px] text-muted-foreground">
                          {u.lastLoginAt.slice(0, 10)}
                        </td>
                        <td className="px-2 py-2.5 text-[12px]">
                          {attention ? (
                            <span className="text-amber-700 dark:text-amber-300">
                              {customerStandingLabel(u.accountStatus)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="space-y-2 md:hidden">
              {sorted.map((u) => {
                const attention = customerNeedsDirectoryAttention(u);
                return (
                  <li key={`mobile-${u.id}`}>
                    <Link
                      to="/internal/users/$userId"
                      params={{ userId: u.id }}
                      search={recordSearch()}
                      className={cn(
                        "block rounded border border-border/60 px-3 py-2.5 hover:border-gold/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                      )}
                      aria-label={`Review customer ${u.discordUsername}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-[13px]">{u.discordUsername}</div>
                          <div className="mt-0.5 text-[12px] text-muted-foreground">
                            {customerProductSummary(u, { includeTerminal })}
                          </div>
                        </div>
                        <StatusBadge status={customerStandingLabel(u.accountStatus)} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground">
                        <span>Last {u.lastLoginAt.slice(0, 10)}</span>
                        <span>{attention ? customerStandingLabel(u.accountStatus) : "Healthy"}</span>
                      </div>
                      <span className="mt-2 inline-block text-[12px] font-medium text-gold">
                        Review customer
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </OpsSection>
    </InternalPageShell>
  );
}
