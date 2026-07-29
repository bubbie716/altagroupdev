import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { StatusBadge } from "@/components/internal/status-badge";
import { OpsConfirmDialog } from "@/components/internal/ops-confirm-dialog";
import {
  OpsFilterBar,
  OpsFilterField,
  OPS_FILTER_FIELD_CLASS,
} from "@/components/internal/console/ops-filter-bar";
import { OpsCsvExportButton } from "@/components/internal/ops-csv-export-button";
import { florin } from "@/lib/bank/api";
import { formatActivityDateTime } from "@/lib/format-datetime";
import {
  INTERNAL_ALTA_PAY_RECORD_SEARCH,
  INTERNAL_INVOICE_RECORD_SEARCH,
  INTERNAL_PAYMENT_LINK_RECORD_SEARCH,
  buildListReturnPath,
  withInternalSiteSearch,
} from "@/lib/internal/internal-route-search";
import { validateDevSiteSearch } from "@/lib/site/preserve-dev-site-search";
import {
  reverseAltaPayAdmin,
  searchAltaPayAdmin,
  searchAltaPayInvoicesAdmin,
  searchAltaPayPaymentLinksAdmin,
} from "@/lib/internal/ops-platform.functions";
import type { AltaPayAdminRow } from "@/lib/internal/ops-types";
import type { MerchantInvoiceSummaryRow } from "@/lib/bank/merchant-invoice-types";
import type { PaymentLinkSummaryRow } from "@/lib/bank/payment-link-types";
import { useUiLabMutationGate } from "@/lib/internal/ui-lab-mutation-gate";
import { MONEY_LIST_PAGE_SIZE } from "@/lib/internal/money-desk";
import { cn } from "@/lib/utils";
import { internalDocumentTitle } from "@/lib/internal/internal-document-title";

export type AltaPayView = "payments" | "invoices" | "links";

export type AltaPaySearch = {
  q?: string;
  ref?: string;
  view?: AltaPayView;
  offset?: number;
  site?: string;
};

function parseView(raw: unknown): AltaPayView | undefined {
  if (raw === "invoices" || raw === "links") return raw;
  if (raw === "payments") return "payments";
  return undefined;
}

export const Route = createFileRoute("/internal/bank/alta-pay/")({
  validateSearch: (s: Record<string, unknown>): AltaPaySearch => {
    const offsetRaw = s.offset;
    const offset =
      typeof offsetRaw === "number"
        ? offsetRaw
        : typeof offsetRaw === "string" && /^\d+$/.test(offsetRaw)
          ? Number(offsetRaw)
          : undefined;
    return {
      q: typeof s.q === "string" && s.q.trim() ? s.q.trim() : undefined,
      ref: typeof s.ref === "string" && s.ref.trim() ? s.ref.trim() : undefined,
      view: parseView(s.view),
      offset: offset && offset > 0 ? offset : undefined,
      site: validateDevSiteSearch(s).site,
    };
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const q = deps.ref ?? deps.q;
    const offset = deps.offset ?? 0;
    const view = deps.view ?? "payments";
    if (view === "invoices") {
      const invoices = await searchAltaPayInvoicesAdmin({
        data: { q, limit: MONEY_LIST_PAGE_SIZE, offset },
      });
      return { view, payments: null, invoices, links: null };
    }
    if (view === "links") {
      const links = await searchAltaPayPaymentLinksAdmin({
        data: { q, limit: MONEY_LIST_PAGE_SIZE, offset },
      });
      return { view, payments: null, invoices: null, links };
    }
    const payments = await searchAltaPayAdmin({
      data: { q, limit: MONEY_LIST_PAGE_SIZE, offset },
    });
    return { view, payments, invoices: null, links: null };
  },
  head: ({ match }) => ({ meta: [{ title: internalDocumentTitle("Alta Pay", (match.search as { site?: string }).site ?? "bank") }] }),
  component: AltaPayOpsPage,
});

function AltaPayOpsPage() {
  const data = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const reverseFn = useServerFn(reverseAltaPayAdmin);
  const [reverseRef, setReverseRef] = useState<string | null>(null);
  const view = search.view ?? "payments";
  const offset = search.offset ?? 0;
  const filtersOn = Boolean(search.q || search.ref);

  const returnFrom = buildListReturnPath("/internal/bank/alta-pay", {
    q: search.q,
    ref: search.ref,
    view: view === "payments" ? undefined : view,
    offset: search.offset,
    site: search.site,
  });

  function patchSearch(patch: Partial<AltaPaySearch>, resetOffset = true) {
    void navigate({
      to: "/internal/bank/alta-pay",
      search: withInternalSiteSearch(
        {
          ...search,
          ...patch,
          ...(resetOffset ? { offset: undefined } : {}),
        },
        search.site,
      ),
      replace: true,
    });
  }

  const tabs: { id: AltaPayView; label: string }[] = [
    { id: "payments", label: "Payments" },
    { id: "invoices", label: "Invoices" },
    { id: "links", label: "Payment links" },
  ];

  return (
    <InternalPageShell title="Alta Pay">
      <p className="mb-5 max-w-2xl text-[13px] text-muted-foreground">
        Merchant payments, invoices, and payment links. Routine exceptions enter through Inbox.
      </p>

      <div className="mb-4 flex flex-wrap gap-1 rounded border border-border/60 bg-surface-1/30 p-1">
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            to="/internal/bank/alta-pay"
            search={withInternalSiteSearch(
              { view: tab.id === "payments" ? undefined : tab.id, q: search.q, ref: search.ref },
              search.site,
            )}
            className={cn(
              "rounded px-3 py-1.5 text-[12px]",
              view === tab.id
                ? "bg-surface-2 font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-current={view === tab.id ? "page" : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <OpsFilterBar
        onClear={
          filtersOn
            ? () =>
                void navigate({
                  to: "/internal/bank/alta-pay",
                  search: withInternalSiteSearch({ view: view === "payments" ? undefined : view }, search.site),
                  replace: true,
                })
            : undefined
        }
      >
        <OpsFilterField label="Search">
          <input
            className={OPS_FILTER_FIELD_CLASS}
            value={search.q ?? search.ref ?? ""}
            onChange={(e) => patchSearch({ q: e.target.value || undefined, ref: undefined })}
            placeholder="Reference, merchant, account…"
            aria-label="Search Alta Pay"
          />
        </OpsFilterField>
      </OpsFilterBar>

      {view === "payments" && data.payments ? (
        <PaymentsView
          payments={data.payments}
          returnFrom={returnFrom}
          site={search.site}
          offset={offset}
          onPage={(next) => patchSearch({ offset: next || undefined }, false)}
          onReverse={setReverseRef}
        />
      ) : null}
      {view === "invoices" && data.invoices ? (
        <InvoicesView
          invoices={data.invoices}
          returnFrom={returnFrom}
          site={search.site}
          offset={offset}
          onPage={(next) => patchSearch({ offset: next || undefined }, false)}
        />
      ) : null}
      {view === "links" && data.links ? (
        <LinksView
          links={data.links}
          returnFrom={returnFrom}
          site={search.site}
          offset={offset}
          onPage={(next) => patchSearch({ offset: next || undefined }, false)}
        />
      ) : null}

      <p className="mt-8 text-[12px] text-muted-foreground">
        Company commercial settings and recipients live on the company record.{" "}
        <Link
          to="/internal/companies"
          search={withInternalSiteSearch({}, search.site)}
          className="text-gold hover:underline"
        >
          Open directory
        </Link>
      </p>

      <OpsConfirmDialog
        open={reverseRef != null}
        title="Reverse Alta Pay payment"
        description={
          reverseRef ? `Reverse payment ${reverseRef}. This creates offsetting transactions.` : undefined
        }
        confirmLabel="Reverse payment"
        variant="danger"
        showSilentNotificationToggle
        onCancel={() => setReverseRef(null)}
        onConfirm={async (reason, options) => {
          if (!reverseRef) return;
          await reverseFn({
            data: {
              referenceCode: reverseRef,
              reason,
              silentNotification: options?.silentNotification,
            },
          });
          setReverseRef(null);
          await router.invalidate();
        }}
      />
    </InternalPageShell>
  );
}

function Pagination({
  offset,
  hasMore,
  onPage,
}: {
  offset: number;
  hasMore: boolean;
  onPage: (next: number) => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="h-8 rounded border border-border px-3 text-[12px] disabled:opacity-40"
        disabled={offset <= 0}
        onClick={() => onPage(Math.max(0, offset - MONEY_LIST_PAGE_SIZE))}
      >
        Previous
      </button>
      <span className="text-[12px] text-muted-foreground">
        Page {Math.floor(offset / MONEY_LIST_PAGE_SIZE) + 1}
      </span>
      <button
        type="button"
        className="h-8 rounded border border-border px-3 text-[12px] disabled:opacity-40"
        disabled={!hasMore}
        onClick={() => onPage(offset + MONEY_LIST_PAGE_SIZE)}
      >
        Next
      </button>
    </div>
  );
}

function PaymentsView({
  payments,
  returnFrom,
  site,
  offset,
  onPage,
  onReverse,
}: {
  payments: Awaited<ReturnType<typeof searchAltaPayAdmin>>;
  returnFrom: string;
  site?: string;
  offset: number;
  onPage: (next: number) => void;
  onReverse: (ref: string) => void;
}) {
  const { uiLab, unavailableLabel } = useUiLabMutationGate();
  const pending = payments.items.filter((p) => p.status.toUpperCase() === "PENDING");

  return (
    <section>
      {pending.length > 0 ? (
        <p className="mb-3 text-[13px] text-amber-700 dark:text-amber-300">
          {pending.length} payment(s) pending on this page.
        </p>
      ) : null}
      <div className="mb-3 flex justify-end">
        <OpsCsvExportButton
          filename="alta-pay-payments.csv"
          headers={["reference", "payer", "merchant", "amount", "status", "date"]}
          getRows={() =>
            payments.items.map((r) => [
              r.referenceCode,
              r.payerLabel,
              r.merchantName,
              r.amount,
              r.status,
              r.createdAt.slice(0, 19),
            ])
          }
        />
      </div>
      {payments.items.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No payments found.</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[40rem] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Payment</th>
                  <th className="px-2 py-2 font-medium">Sender → recipient</th>
                  <th className="px-2 py-2 font-medium">Amount</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {payments.items.map((r) => (
                  <tr key={`desktop-${r.referenceCode}`} className="border-b border-border/40">
                    <td className="px-2 py-2.5">
                      <Link
                        to="/internal/bank/alta-pay/$referenceCode"
                        params={{ referenceCode: r.referenceCode }}
                        search={withInternalSiteSearch(
                          { ...INTERNAL_ALTA_PAY_RECORD_SEARCH, from: returnFrom },
                          site,
                        )}
                        className="font-mono text-[11px] hover:text-gold"
                      >
                        {r.referenceCode}
                      </Link>
                    </td>
                    <td className="px-2 py-2.5 text-muted-foreground">
                      {r.payerLabel} → {r.merchantName}
                    </td>
                    <td className="px-2 py-2.5 type-finance tabular-nums">{florin(r.amount)}</td>
                    <td className="px-2 py-2.5">
                      <StatusBadge status={r.status} />
                      {r.status === "APPROVED" ? (
                        uiLab ? (
                          <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                            {unavailableLabel("Reverse")}
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="mt-1 font-mono text-[10px] uppercase text-destructive"
                            onClick={() => onReverse(r.referenceCode)}
                          >
                            Reverse
                          </button>
                        )
                      ) : null}
                    </td>
                    <td className="px-2 py-2.5 font-mono text-[11px] text-muted-foreground">
                      {formatActivityDateTime(r.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-2 md:hidden">
            {payments.items.map((r: AltaPayAdminRow) => (
              <li key={`mobile-${r.referenceCode}`}>
                <Link
                  to="/internal/bank/alta-pay/$referenceCode"
                  params={{ referenceCode: r.referenceCode }}
                  search={withInternalSiteSearch(
                    { ...INTERNAL_ALTA_PAY_RECORD_SEARCH, from: returnFrom },
                    site,
                  )}
                  className="block rounded border border-border/60 px-3 py-2.5 hover:border-gold/40"
                  aria-label={`Review payment ${r.referenceCode}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium">
                        {r.payerLabel} → {r.merchantName}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {formatActivityDateTime(r.createdAt)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="type-finance tabular-nums text-[12px]">{florin(r.amount)}</p>
                      <div className="mt-1">
                        <StatusBadge status={r.status} />
                      </div>
                    </div>
                  </div>
                  <span className="mt-2 inline-block text-[12px] font-medium text-gold">
                    Review payment
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination offset={offset} hasMore={payments.hasMore} onPage={onPage} />
        </>
      )}
    </section>
  );
}

function InvoicesView({
  invoices,
  returnFrom,
  site,
  offset,
  onPage,
}: {
  invoices: { items: MerchantInvoiceSummaryRow[]; total: number; hasMore?: boolean };
  returnFrom: string;
  site?: string;
  offset: number;
  onPage: (next: number) => void;
}) {
  const hasMore = invoices.hasMore ?? offset + invoices.items.length < invoices.total;
  return (
    <section>
      {invoices.items.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No invoices found.</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[40rem] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Invoice</th>
                  <th className="px-2 py-2 font-medium">Company / customer</th>
                  <th className="px-2 py-2 font-medium">Amount</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Due</th>
                </tr>
              </thead>
              <tbody>
                {invoices.items.map((r) => (
                  <tr key={`desktop-${r.id}`} className="border-b border-border/40">
                    <td className="px-2 py-2.5">
                      <Link
                        to="/internal/bank/alta-pay/invoices/$invoiceId"
                        params={{ invoiceId: r.id }}
                        search={withInternalSiteSearch(
                          { ...INTERNAL_INVOICE_RECORD_SEARCH, from: returnFrom },
                          site,
                        )}
                        className="font-mono text-[11px] hover:text-gold"
                      >
                        {r.referenceCode}
                      </Link>
                    </td>
                    <td className="px-2 py-2.5 text-muted-foreground">
                      {r.merchantName} → {r.recipientName}
                    </td>
                    <td className="px-2 py-2.5 type-finance tabular-nums">{florin(r.amount)}</td>
                    <td className="px-2 py-2.5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-2 py-2.5 font-mono text-[11px] text-muted-foreground">
                      {r.dueDate ? r.dueDate.slice(0, 10) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-2 md:hidden">
            {invoices.items.map((r) => (
              <li key={`mobile-${r.id}`}>
                <Link
                  to="/internal/bank/alta-pay/invoices/$invoiceId"
                  params={{ invoiceId: r.id }}
                  search={withInternalSiteSearch(
                    { ...INTERNAL_INVOICE_RECORD_SEARCH, from: returnFrom },
                    site,
                  )}
                  className="block rounded border border-border/60 px-3 py-2.5 hover:border-gold/40"
                  aria-label={`Review invoice ${r.referenceCode}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium">{r.referenceCode}</p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        {r.merchantName} → {r.recipientName}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="type-finance tabular-nums text-[12px]">{florin(r.amount)}</p>
                      <div className="mt-1">
                        <StatusBadge status={r.status} />
                      </div>
                    </div>
                  </div>
                  <span className="mt-2 inline-block text-[12px] font-medium text-gold">
                    Review invoice
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination offset={offset} hasMore={hasMore} onPage={onPage} />
        </>
      )}
    </section>
  );
}

function LinksView({
  links,
  returnFrom,
  site,
  offset,
  onPage,
}: {
  links: { items: PaymentLinkSummaryRow[]; total: number; hasMore?: boolean };
  returnFrom: string;
  site?: string;
  offset: number;
  onPage: (next: number) => void;
}) {
  const hasMore = links.hasMore ?? offset + links.items.length < links.total;
  return (
    <section>
      {links.items.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No payment links found.</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[40rem] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-2 font-medium">Link</th>
                  <th className="px-2 py-2 font-medium">Company</th>
                  <th className="px-2 py-2 font-medium">Amount</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Usage</th>
                </tr>
              </thead>
              <tbody>
                {links.items.map((r) => (
                  <tr key={`desktop-${r.id}`} className="border-b border-border/40">
                    <td className="px-2 py-2.5">
                      <Link
                        to="/internal/bank/alta-pay/payment-links/$linkId"
                        params={{ linkId: r.id }}
                        search={withInternalSiteSearch(
                          { ...INTERNAL_PAYMENT_LINK_RECORD_SEARCH, from: returnFrom },
                          site,
                        )}
                        className="font-mono text-[11px] hover:text-gold"
                      >
                        {r.referenceCode}
                      </Link>
                      {r.title ? (
                        <div className="text-[12px] text-muted-foreground">{r.title}</div>
                      ) : null}
                    </td>
                    <td className="px-2 py-2.5 text-muted-foreground">{r.merchantName}</td>
                    <td className="px-2 py-2.5 type-finance tabular-nums">
                      {r.amount != null ? florin(r.amount) : "Flexible"}
                    </td>
                    <td className="px-2 py-2.5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-2 py-2.5 text-[12px] text-muted-foreground">
                      {r.paymentCount} payment{r.paymentCount === 1 ? "" : "s"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="space-y-2 md:hidden">
            {links.items.map((r) => (
              <li key={`mobile-${r.id}`}>
                <Link
                  to="/internal/bank/alta-pay/payment-links/$linkId"
                  params={{ linkId: r.id }}
                  search={withInternalSiteSearch(
                    { ...INTERNAL_PAYMENT_LINK_RECORD_SEARCH, from: returnFrom },
                    site,
                  )}
                  className="block rounded border border-border/60 px-3 py-2.5 hover:border-gold/40"
                  aria-label={`Review payment link ${r.referenceCode}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-[12px] font-medium">{r.referenceCode}</p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">{r.merchantName}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="type-finance tabular-nums text-[12px]">
                        {r.amount != null ? florin(r.amount) : "Flexible"}
                      </p>
                      <div className="mt-1">
                        <StatusBadge status={r.status} />
                      </div>
                    </div>
                  </div>
                  <span className="mt-2 inline-block text-[12px] font-medium text-gold">
                    Review payment link
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination offset={offset} hasMore={hasMore} onPage={onPage} />
        </>
      )}
    </section>
  );
}
