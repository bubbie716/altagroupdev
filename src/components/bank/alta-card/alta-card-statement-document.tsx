import { useRef, useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import type { AltaCardRow, AltaCardStatementDetail, AltaCardTransactionTypeCode } from "@/lib/bank/alta-card-types";
import {
  ALTA_CARD_STATEMENT_STATUS_LABELS,
  ALTA_CARD_TIER_LABELS,
  altaCardEmployeeTransactionAttribution,
  altaCardTransactionLabel,
  altaCardTransactionSignedAmount,
  formatAltaCardCurrency,
  isAltaCardCustomPeriodStatement,
} from "@/lib/bank/alta-card-types";
import { AltaWordmark } from "@/components/alta-logo";
import { RouteButton } from "@/components/bank/route-button";
import { downloadElementAsPdf } from "@/lib/bank/download-statement-pdf";
import { formatAltaCardBillingDate } from "@/lib/bank/alta-card-billing-cycle";
import { formatActivityDateTime, formatStatementTransactionDateTime } from "@/lib/format-datetime";
import { altaCardStatementsLink } from "@/lib/bank/alta-card-navigation";
import { altaCardNavButtonClassName } from "@/components/bank/alta-card/alta-card-back-to-card-link";
import { TX_DESC_SEP } from "@/lib/bank/customer-transaction-copy";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return formatAltaCardBillingDate(iso);
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

const STATEMENT_TX_HEAD =
  "px-2 py-2 text-left align-bottom font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground print:text-neutral-600 first:pl-0 last:pr-0";
const STATEMENT_TX_CELL = "px-2 py-2.5 align-top first:pl-0 last:pr-0";

function statementTransactionMetaLines(
  tx: AltaCardStatementDetail["transactions"][number],
  showEmployeeColumn: boolean,
): string[] {
  const lines: string[] = [];
  if (showEmployeeColumn) {
    lines.push(altaCardEmployeeTransactionAttribution(tx) ?? "Company line");
  }
  lines.push(tx.referenceCode);
  return lines;
}

function statementTransactionDescription(
  type: AltaCardTransactionTypeCode,
  description: string,
): string {
  const label = altaCardTransactionLabel(type);
  const prefix = `${label}${TX_DESC_SEP}`;
  if (description.startsWith(prefix)) {
    return description.slice(prefix.length);
  }
  return description;
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
  const isActivitySummary = isAltaCardCustomPeriodStatement(statement.status);
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
        {isActivitySummary ? (
          <div className="mb-8 rounded-lg border border-border/70 bg-surface-2/30 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground print:border-neutral-300 print:bg-transparent print:text-neutral-700">
            This activity summary is for your records only. It is not an official billing statement
            and does not create a payment obligation. Official Alta Card statements are issued
            automatically at the end of each billing cycle.
          </div>
        ) : null}

        <header className="border-b-2 border-foreground/80 pb-8 print:border-black">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <AltaWordmark className="print:text-black" />
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground print:text-neutral-600">
                Alta Bank · Alta Card · Newport
              </p>
            </div>
            <div className="text-right">
              <div className="type-meta print:text-neutral-600">
                {isActivitySummary ? "Activity summary" : "Credit card statement"}
              </div>
              <div className="mt-1 font-mono text-[13px] print:text-black">
                #{statement.statementNumber}
              </div>
              <div className="mt-2 text-[12px] text-muted-foreground print:text-neutral-600">
                {isActivitySummary ? "Generated" : "Statement date"}{" "}
                {formatDate(statement.statementDate ?? statement.createdAt)}
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
            <div className="type-meta-accent print:text-neutral-700">
              {isActivitySummary ? "Summary type" : "Statement status"}
            </div>
            <p className="mt-2 text-[15px] font-medium print:text-black">
              {ALTA_CARD_STATEMENT_STATUS_LABELS[statement.status]}
            </p>
            {!isActivitySummary ? (
              <p className="mt-1 text-[13px] text-muted-foreground print:text-neutral-600">
                Payment due {formatDate(statement.dueDate)}
              </p>
            ) : null}
          </div>
        </section>

        <section className="mt-8 border-b border-border/60 pb-8 print:border-neutral-300">
          <div className="type-meta-accent print:text-neutral-700">
            {isActivitySummary ? "Activity period" : "Billing period"}
          </div>
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
            [
              isActivitySummary ? "Period ending balance" : "Statement balance",
              formatAltaCardCurrency(isActivitySummary ? statement.endingBalance : statement.statementBalance),
            ],
            ...(isActivitySummary
              ? []
              : [["Remaining balance", formatAltaCardCurrency(statement.remainingBalance)]]),
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

        {!isActivitySummary ? (
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
        ) : null}

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
                  const detail = statementTransactionDescription(tx.type, tx.description);
                  return (
                    <li key={tx.id} className="flex items-start justify-between gap-4 py-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium">{altaCardTransactionLabel(tx.type)}</p>
                        <p className="mt-0.5 break-words text-[12px] text-muted-foreground">{detail}</p>
                        {tx.merchantCompanyName ? (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{tx.merchantCompanyName}</p>
                        ) : null}
                        <p className="mt-1 break-words font-mono text-[10px] text-muted-foreground">
                          {statementTransactionMetaLines(tx, showEmployeeColumn).join(" · ")}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
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
              <div className="mt-4 hidden md:block">
              <table className="w-full table-fixed border-separate border-spacing-0 text-[12px] print:text-[11px]">
                <thead>
                  <tr className="border-b border-border print:border-black">
                    <th className={`${STATEMENT_TX_HEAD} w-[20%]`}>Date</th>
                    <th className={`${STATEMENT_TX_HEAD} w-[18%]`}>Type</th>
                    <th className={`${STATEMENT_TX_HEAD} w-[50%]`}>Description</th>
                    <th className={`${STATEMENT_TX_HEAD} w-[12%] text-right`}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.transactions.map((tx) => {
                    const signed = altaCardTransactionSignedAmount(tx.type, tx.amount);
                    const prefix = signed > 0 ? "+" : signed < 0 ? "−" : "";
                    const detail = statementTransactionDescription(tx.type, tx.description);
                    const { dateLine, timeLine } = formatStatementTransactionDateTime(tx.createdAt);
                    const meta = statementTransactionMetaLines(tx, showEmployeeColumn).join(" · ");
                    return (
                      <tr
                        key={tx.id}
                        className="statement-document__row border-b border-border/40 print:border-neutral-200"
                      >
                        <td className={`${STATEMENT_TX_CELL} text-muted-foreground print:text-neutral-600`}>
                          <div className="text-[11px] leading-snug">{dateLine}</div>
                          {timeLine ? (
                            <div className="mt-0.5 text-[10px] leading-snug">{timeLine}</div>
                          ) : null}
                        </td>
                        <td className={`${STATEMENT_TX_CELL} text-[11px] leading-snug print:text-black`}>
                          {altaCardTransactionLabel(tx.type)}
                        </td>
                        <td className={`${STATEMENT_TX_CELL} print:text-black`}>
                          <div className="break-words">{detail}</div>
                          {tx.merchantCompanyName ? (
                            <div className="mt-0.5 break-words text-[10px] text-muted-foreground print:text-neutral-600">
                              {tx.merchantCompanyName}
                            </div>
                          ) : null}
                          <div className="mt-1 break-words font-mono text-[10px] leading-snug text-muted-foreground print:text-neutral-600">
                            {meta}
                          </div>
                        </td>
                        <td className={`${STATEMENT_TX_CELL} whitespace-nowrap text-right type-finance-nums print:text-black`}>
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
