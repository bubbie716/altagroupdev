import { useRef, useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import type { AltaCardRow, AltaCardStatementDetail } from "@/lib/bank/alta-card-types";
import {
  ALTA_CARD_STATEMENT_STATUS_LABELS,
  ALTA_CARD_TIER_LABELS,
  altaCardEmployeeTransactionAttribution,
  altaCardTransactionLabel,
  altaCardTransactionSignedAmount,
  formatAltaCardCurrency,
} from "@/lib/bank/alta-card-types";
import { AltaWordmark } from "@/components/alta-logo";
import { RouteButton } from "@/components/bank/route-button";
import { downloadElementAsPdf } from "@/lib/bank/download-statement-pdf";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { altaCardStatementsLink } from "@/lib/bank/alta-card-navigation";
import { altaCardNavButtonClassName } from "@/components/bank/alta-card/alta-card-back-to-card-link";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function cardholderLabel(card: Pick<AltaCardRow, "cardType" | "companyName" | "ownerUsername">): string {
  if (card.cardType === "business" && card.companyName) return card.companyName;
  return card.ownerUsername ?? "Cardholder";
}

function cardSubtitle(card: Pick<AltaCardRow, "cardType" | "tier" | "cardLastFour">): string {
  const ending = `ending ${card.cardLastFour}`;
  if (card.cardType === "business") return `Business Alta Card · ${ending}`;
  return `${ALTA_CARD_TIER_LABELS[card.tier]} · ${ending}`;
}

export function AltaCardStatementDocument({
  statement,
  card,
}: {
  statement: AltaCardStatementDetail;
  card: AltaCardRow;
}) {
  const pageRef = useRef<HTMLElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const backTo = { ...altaCardStatementsLink(card), label: "All statements" };
  const showEmployeeColumn =
    card.cardType === "business" &&
    statement.transactions.some((tx) => tx.altaEmployeeCardId != null);

  async function handleDownloadPdf() {
    const element = pageRef.current;
    if (!element || exporting) return;

    setExporting(true);
    setExportError(null);

    try {
      await downloadElementAsPdf(element, `alta-card-statement-${statement.statementNumber}.pdf`);
    } catch {
      setExportError("Could not generate PDF. Try Print instead, or refresh and retry.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="statement-document min-w-0 max-w-full">
      <div className="mb-8 flex flex-col gap-4 print:hidden sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleDownloadPdf()}
              disabled={exporting}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-2 px-4 py-2 text-[13px] font-medium transition-colors hover:bg-surface-2/80 disabled:cursor-wait disabled:opacity-70"
            >
              {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {exporting ? "Generating PDF…" : "Download PDF"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface-2 px-4 py-2 text-[13px] font-medium transition-colors hover:bg-surface-2/80"
            >
              <Printer className="size-4" />
              Print
            </button>
          </div>
          {exportError ? <p className="mt-2 text-[12px] text-destructive">{exportError}</p> : null}
        </div>
        <RouteButton
          to={backTo.to}
          params={"params" in backTo ? backTo.params : undefined}
          className={altaCardNavButtonClassName}
        >
          ← {backTo.label}
        </RouteButton>
      </div>

      <article
        ref={pageRef}
        className="statement-document__page mx-auto min-w-0 max-w-[820px] border border-border/80 bg-surface-1 px-4 py-8 shadow-card sm:px-8 sm:py-10 print:mx-0 print:max-w-none print:border-0 print:bg-white print:px-0 print:py-0 print:shadow-none"
      >
        <header className="border-b-2 border-foreground/80 pb-8 print:border-black">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <AltaWordmark className="print:text-black" />
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground print:text-neutral-600">
                Alta Bank · Alta Card · Newport
              </p>
            </div>
            <div className="text-right">
              <div className="type-meta print:text-neutral-600">Credit card statement</div>
              <div className="mt-1 font-mono text-[13px] print:text-black">
                #{statement.statementNumber}
              </div>
              <div className="mt-2 text-[12px] text-muted-foreground print:text-neutral-600">
                Statement date {formatDate(statement.statementDate ?? statement.createdAt)}
              </div>
            </div>
          </div>
        </header>

        <section className="mt-8 grid gap-8 border-b border-border/60 pb-8 print:border-neutral-300 md:grid-cols-2">
          <div>
            <div className="type-meta-accent print:text-neutral-700">Cardholder</div>
            <p className="mt-2 text-[15px] font-medium print:text-black">{cardholderLabel(card)}</p>
            <p className="mt-1 text-[13px] text-muted-foreground print:text-neutral-600">
              {cardSubtitle(card)}
            </p>
          </div>
          <div>
            <div className="type-meta-accent print:text-neutral-700">Statement status</div>
            <p className="mt-2 text-[15px] font-medium print:text-black">
              {ALTA_CARD_STATEMENT_STATUS_LABELS[statement.status]}
            </p>
            <p className="mt-1 text-[13px] text-muted-foreground print:text-neutral-600">
              Payment due {formatDate(statement.dueDate)}
            </p>
          </div>
        </section>

        <section className="mt-8 border-b border-border/60 pb-8 print:border-neutral-300">
          <div className="type-meta-accent print:text-neutral-700">Billing period</div>
          <p className="mt-2 text-[15px] print:text-black">
            {formatDate(statement.billingPeriodStart)} – {formatDate(statement.billingPeriodEnd)}
          </p>
        </section>

        <section className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Previous balance", formatAltaCardCurrency(statement.previousBalance)],
            ["Purchases", formatAltaCardCurrency(statement.purchases)],
            ["Payments", formatAltaCardCurrency(statement.payments)],
            ["Adjustments", formatAltaCardCurrency(statement.adjustments)],
            ["Interest charged", formatAltaCardCurrency(statement.interestCharged)],
            ["Fees charged", formatAltaCardCurrency(statement.feesCharged)],
            ["Statement balance", formatAltaCardCurrency(statement.statementBalance)],
            ["Remaining balance", formatAltaCardCurrency(statement.remainingBalance)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="statement-document__stat rounded-md border border-border/50 bg-surface-2/30 px-4 py-3 print:border-neutral-300 print:bg-transparent"
            >
              <div className="type-meta-sm print:text-neutral-600">{label}</div>
              <div className="mt-1 font-mono text-[14px] tabular-nums print:text-black">{value}</div>
            </div>
          ))}
        </section>

        <section className="mt-8 grid gap-6 border-b border-border/60 pb-8 print:border-neutral-300 sm:grid-cols-3">
          <div className="statement-document__stat rounded-md border border-border/50 bg-surface-2/30 px-4 py-4 print:border-neutral-300 print:bg-transparent">
            <div className="type-meta-sm print:text-neutral-600">Minimum payment due</div>
            <div className="mt-2 font-serif text-[22px] tabular-nums tracking-tight print:text-black">
              {formatAltaCardCurrency(statement.minimumPayment)}
            </div>
          </div>
          <div className="statement-document__stat rounded-md border border-border/50 bg-surface-2/30 px-4 py-4 print:border-neutral-300 print:bg-transparent">
            <div className="type-meta-sm print:text-neutral-600">Amount paid</div>
            <div className="mt-2 font-mono text-[18px] tabular-nums print:text-black">
              {formatAltaCardCurrency(statement.amountPaid)}
            </div>
          </div>
          <div className="statement-document__stat rounded-md border border-border/50 bg-surface-2/30 px-4 py-4 print:border-neutral-300 print:bg-transparent">
            <div className="type-meta-sm print:text-neutral-600">Ending balance</div>
            <div className="mt-2 font-mono text-[18px] tabular-nums print:text-black">
              {formatAltaCardCurrency(statement.endingBalance)}
            </div>
          </div>
        </section>

        <section className="statement-document__transactions mt-10">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold print:text-neutral-700">
            Transaction detail
          </div>
          {statement.transactions.length === 0 ? (
            <p className="mt-4 text-[13px] text-muted-foreground print:text-neutral-600">
              No transactions in this billing period.
            </p>
          ) : (
            <>
              <ul className="mt-4 divide-y divide-border/60 md:hidden">
                {statement.transactions.map((tx) => {
                  const signed = altaCardTransactionSignedAmount(tx.type, tx.amount);
                  const prefix = signed > 0 ? "+" : signed < 0 ? "−" : "";
                  return (
                    <li key={tx.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium">{altaCardTransactionLabel(tx.type)}</p>
                        <p className="break-words text-[12px] text-muted-foreground">{tx.description}</p>
                        {showEmployeeColumn ? (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {altaCardEmployeeTransactionAttribution(tx) ?? "Company line"}
                          </p>
                        ) : null}
                        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                          {formatActivityDateTime(tx.createdAt)}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-[13px] tabular-nums">
                        {prefix}
                        {formatAltaCardCurrency(Math.abs(tx.amount))}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-4 hidden min-w-0 max-w-full overflow-x-auto overscroll-x-contain md:block print:overflow-visible">
              <table className="w-full min-w-[560px] border-collapse text-[12px] print:text-[11px]">
                <thead>
                  <tr className="border-b border-border print:border-black">
                    <th className="py-2 text-left font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground print:text-neutral-600">
                      Date & time
                    </th>
                    <th className="py-2 text-left font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground print:text-neutral-600">
                      Type
                    </th>
                    <th className="py-2 text-left font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground print:text-neutral-600">
                      Description
                    </th>
                    {showEmployeeColumn ? (
                      <th className="py-2 text-left font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground print:text-neutral-600">
                        Employee card
                      </th>
                    ) : null}
                    <th className="py-2 text-left font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground print:text-neutral-600">
                      Ref
                    </th>
                    <th className="py-2 text-right font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground print:text-neutral-600">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {statement.transactions.map((tx) => {
                    const signed = altaCardTransactionSignedAmount(tx.type, tx.amount);
                    const prefix = signed > 0 ? "+" : signed < 0 ? "−" : "";
                    return (
                      <tr
                        key={tx.id}
                        className="statement-document__row border-b border-border/40 print:border-neutral-200"
                      >
                        <td className="py-2.5 text-muted-foreground print:text-neutral-600">
                          {formatActivityDateTime(tx.createdAt)}
                        </td>
                        <td className="py-2.5 print:text-black">{altaCardTransactionLabel(tx.type)}</td>
                        <td className="py-2.5 print:text-black">
                          <div>{tx.description}</div>
                          {tx.merchantCompanyName ? (
                            <div className="text-[10px] text-muted-foreground print:text-neutral-600">
                              {tx.merchantCompanyName}
                            </div>
                          ) : null}
                        </td>
                        {showEmployeeColumn ? (
                          <td className="py-2.5 text-[11px] print:text-black">
                            {altaCardEmployeeTransactionAttribution(tx) ?? "Company line"}
                          </td>
                        ) : null}
                        <td className="py-2.5 font-mono text-[10px] print:text-black">{tx.referenceCode}</td>
                        <td className="py-2.5 text-right type-finance-nums print:text-black">
                          {prefix}
                          {formatAltaCardCurrency(Math.abs(tx.amount))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </>
          )}
        </section>
      </article>
    </div>
  );
}
