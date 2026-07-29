import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { OpsSection } from "@/components/internal/console";
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";
import { buildBreadcrumbs } from "@/components/internal/console/internal-breadcrumbs";
import {
  OpsFilterBar,
  OpsFilterField,
  OPS_FILTER_FIELD_CLASS,
} from "@/components/internal/console/ops-filter-bar";
import {
  fetchInternalLoansFiltered,
  type InternalLoansSearchInput,
} from "@/lib/bank/lending.functions";
import type { InternalActiveLoanRow } from "@/lib/bank/lending-types";
import {
  formatLoanBorrowerTypeLabel,
  formatLoanOutstanding,
  loanBorrowerType,
  loanNeedsDirectoryAttention,
  nextLoanDueLabel,
} from "@/lib/internal/lending-desk";
import {
  INTERNAL_LOAN_WORKSPACE_SEARCH,
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";
import { buildListReturnPath } from "@/lib/internal/record-workspace-search";
import { readDevSiteFromSearch } from "@/lib/site/preserve-dev-site-search";
import { cn } from "@/lib/utils";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export type LendingLoansSearch = InternalLoansSearchInput;

const PAGE_SIZE = 50;

export const Route = createFileRoute("/internal/lending/loans/")({
  validateSearch: (search: Record<string, unknown>): LendingLoansSearch => {
    const str = (key: string) =>
      typeof search[key] === "string" && (search[key] as string).trim()
        ? (search[key] as string).trim()
        : undefined;
    const offsetRaw = search.offset;
    const offset =
      typeof offsetRaw === "number"
        ? offsetRaw
        : typeof offsetRaw === "string" && /^\d+$/.test(offsetRaw)
          ? Number(offsetRaw)
          : undefined;
    const borrowerType = str("borrowerType");
    return {
      q: str("q"),
      status: str("status"),
      borrowerType:
        borrowerType === "personal" || borrowerType === "company" ? borrowerType : undefined,
      attention: str("attention"),
      offset,
      site: readDevSiteFromSearch(search),
    };
  },
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => fetchInternalLoansFiltered({ data: deps }),
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Loans", (match.search as { site?: string }).site) }] }),
  component: InternalLendingLoansDirectory,
});

function filtersActive(search: LendingLoansSearch): boolean {
  return Boolean(search.q || search.status || search.borrowerType || search.attention);
}

function loanHrefSearch(from: string, site?: string) {
  return { ...withInternalSiteSearch(INTERNAL_LOAN_WORKSPACE_SEARCH, site), from };
}

function InternalLendingLoansDirectory() {
  const page = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const offset = search.offset ?? 0;
  const returnFrom = buildListReturnPath("/internal/lending/loans", {
    q: search.q,
    status: search.status,
    borrowerType: search.borrowerType,
    attention: search.attention,
    site: search.site,
  });

  function patchSearch(patch: Partial<LendingLoansSearch>, resetOffset = true) {
    void navigate({
      to: "/internal/lending/loans",
      search: withInternalSiteSearch(
        {
          ...search,
          ...patch,
          ...(resetOffset ? { offset: undefined } : {}),
        },
        search.site,
      ),
    });
  }

  return (
    <InternalPageShell
      title="Loans"
      breadcrumbs={buildBreadcrumbs([
        { label: "Products", to: "/internal/lending", search: withInternalSiteSearch({}, search.site) },
        { label: "Lending", to: "/internal/lending", search: withInternalSiteSearch({}, search.site) },
        { label: "Loans" },
      ])}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          patchSearch({
            q: (fd.get("q") as string) || undefined,
            status: (fd.get("status") as string) || undefined,
            borrowerType: ((fd.get("borrowerType") as string) || undefined) as
              | "personal"
              | "company"
              | undefined,
            attention: (fd.get("attention") as string) || undefined,
          });
        }}
      >
        <OpsFilterBar className="sm:grid-cols-2 lg:grid-cols-4">
          <OpsFilterField label="Search">
            <input
              name="q"
              defaultValue={search.q ?? ""}
              placeholder="Borrower, company, product, ID…"
              className={OPS_FILTER_FIELD_CLASS}
            />
          </OpsFilterField>
          <OpsFilterField label="Status">
            <select name="status" defaultValue={search.status ?? ""} className={OPS_FILTER_FIELD_CLASS}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="frozen">Frozen</option>
              <option value="paid_off">Paid off</option>
              <option value="defaulted">Defaulted</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </OpsFilterField>
          <OpsFilterField label="Borrower type">
            <select
              name="borrowerType"
              defaultValue={search.borrowerType ?? ""}
              className={OPS_FILTER_FIELD_CLASS}
            >
              <option value="">All types</option>
              <option value="personal">Personal</option>
              <option value="company">Company</option>
            </select>
          </OpsFilterField>
          <OpsFilterField label="Needs attention">
            <select
              name="attention"
              defaultValue={search.attention ?? ""}
              className={OPS_FILTER_FIELD_CLASS}
            >
              <option value="">Any</option>
              <option value="1">Needs attention</option>
            </select>
          </OpsFilterField>
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              className="h-8 rounded border border-gold/40 bg-gold/10 px-3 text-[12px] font-medium text-gold"
            >
              Apply
            </button>
            {filtersActive(search) ? (
              <Link
                to="/internal/lending/loans"
                search={withInternalSiteSearch({}, search.site)}
                className="inline-flex h-8 items-center rounded border border-border px-3 text-[12px] text-muted-foreground"
              >
                Clear
              </Link>
            ) : null}
          </div>
        </OpsFilterBar>
      </form>

      <OpsSection
        title={`Loans ${page.rows.length ? `${offset + 1}–${offset + page.rows.length}` : "(0)"}${page.hasMore ? "+" : ""}`}
        className="mt-6"
      >
        {page.rows.length === 0 ? (
          <p className="rounded-md border border-border/60 bg-surface-1/40 px-3 py-4 text-[13px] text-muted-foreground">
            {filtersActive(search)
              ? "No loans match the current filters."
              : "No loans on record yet."}
          </p>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-md border border-border/60 md:block">
              <table className="w-full text-left text-[13px]">
                <thead className="border-b border-border/60 bg-surface-1/40">
                  <tr>
                    <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Loan
                    </th>
                    <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Borrower
                    </th>
                    <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Type
                    </th>
                    <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Outstanding
                    </th>
                    <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Status
                    </th>
                    <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Next due
                    </th>
                    <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {page.rows.map((loan) => (
                    <LoanDesktopRow
                      key={`desktop-${loan.id}`}
                      loan={loan}
                      from={returnFrom}
                      site={search.site}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="space-y-2 md:hidden">
              {page.rows.map((loan) => (
                <li key={`mobile-${loan.id}`}>
                  <Link
                    to="/internal/lending/loans/$loanId"
                    params={{ loanId: loan.id }}
                    search={loanHrefSearch(returnFrom, search.site)}
                    className={cn(
                      "block rounded-md border border-border/60 bg-surface-1/40 px-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50",
                      loanNeedsDirectoryAttention(loan) && "border-destructive/30",
                    )}
                    aria-label={`Review loan ${loan.productLabel} for ${loan.borrowerLabel}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-[13px]">{loan.productLabel}</div>
                        <div className="text-[12px] text-muted-foreground">{loan.borrowerLabel}</div>
                      </div>
                      <OpsStatusBadge status={loan.statusLabel} />
                    </div>
                    <div className="mt-2 grid gap-0.5 text-[12px] text-muted-foreground">
                      <div>{formatLoanOutstanding(loan)}</div>
                      <div>{nextLoanDueLabel(loan)}</div>
                    </div>
                    <div className="mt-2 text-[12px] font-medium text-gold">Review loan</div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            disabled={offset <= 0}
            className="rounded border border-border px-3 py-1.5 text-[12px] disabled:opacity-40"
            onClick={() => patchSearch({ offset: Math.max(0, offset - PAGE_SIZE) }, false)}
          >
            Previous
          </button>
          <span className="text-[12px] text-muted-foreground">
            Page {Math.floor(offset / PAGE_SIZE) + 1}
          </span>
          <button
            type="button"
            disabled={!page.hasMore}
            className="rounded border border-border px-3 py-1.5 text-[12px] disabled:opacity-40"
            onClick={() => patchSearch({ offset: offset + PAGE_SIZE }, false)}
          >
            Next
          </button>
        </div>
      </OpsSection>
    </InternalPageShell>
  );
}

function LoanDesktopRow({
  loan,
  from,
  site,
}: {
  loan: InternalActiveLoanRow;
  from: string;
  site?: string;
}) {
  return (
    <tr
      className={cn(
        "border-b border-border/40 last:border-0 hover:bg-surface-1/50",
        loanNeedsDirectoryAttention(loan) && "bg-destructive/[0.03]",
      )}
    >
      <td className="px-3 py-2.5">
        <Link
          to="/internal/lending/loans/$loanId"
          params={{ loanId: loan.id }}
          search={loanHrefSearch(from, site)}
          className="font-medium hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
        >
          {loan.productLabel}
        </Link>
        <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{loan.id.slice(0, 10)}</div>
      </td>
      <td className="px-3 py-2.5">
        <div>{loan.borrowerLabel}</div>
        {loan.companyName && loan.companyName !== loan.borrowerLabel ? (
          <div className="text-[11px] text-muted-foreground">{loan.companyName}</div>
        ) : null}
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">
        {formatLoanBorrowerTypeLabel(loanBorrowerType(loan))}
      </td>
      <td className="px-3 py-2.5 tabular-nums">{formatLoanOutstanding(loan)}</td>
      <td className="px-3 py-2.5">
        <OpsStatusBadge status={loan.statusLabel} />
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">{nextLoanDueLabel(loan)}</td>
      <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
        {loan.updatedAt.slice(0, 10)}
      </td>
    </tr>
  );
}
