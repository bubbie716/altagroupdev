import { useRef, useState } from "react";
import { Download, Loader2, Printer } from "lucide-react";
import type { BankStatementDetail } from "@/lib/bank/statement-types";
import { florin } from "@/lib/bank/api";
import { AltaWordmark } from "@/components/alta-logo";
import { downloadElementAsPdf } from "@/lib/bank/download-statement-pdf";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { getSignedBankTransactionAmount } from "@/lib/bank/transaction-display";
import { RouteButton } from "@/components/bank/route-button";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function StatementDocument({
  statement,
  backTo,
}: {
  statement: BankStatementDetail;
  backTo: {
    to: string;
    params?: Record<string, string>;
    search?: Record<string, string>;
    label: string;
  };
}) {
  const pageRef = useRef<HTMLElement>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleDownloadPdf() {
    const element = pageRef.current;
    if (!element || exporting) return;

    setExporting(true);
    setExportError(null);

    try {
      await downloadElementAsPdf(element, `${statement.statementNumber}.pdf`);
    } catch {
      setExportError("Could not generate PDF. Try Print instead, or refresh and retry.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="statement-document">
      <div className="mb-8 flex flex-col gap-4 print:hidden sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
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
          params={backTo.params}
          search={backTo.search}
          className="shrink-0 rounded-md border border-border bg-surface-2/40 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground"
        >
          ← {backTo.label}
        </RouteButton>
      </div>

      <article
        ref={pageRef}
        className="statement-document__page mx-auto max-w-[820px] border border-border/80 bg-surface-1 px-8 py-10 shadow-card print:mx-0 print:max-w-none print:border-0 print:bg-white print:px-0 print:py-0 print:shadow-none"
      >
        <header className="border-b-2 border-foreground/80 pb-8 print:border-black">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <AltaWordmark className="print:text-black" />
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground print:text-neutral-600">
                Alta Bank · Newport
              </p>
            </div>
            <div className="text-right">
              <div className="type-meta print:text-neutral-600">
                Account statement
              </div>
              <div className="mt-1 font-mono text-[13px] print:text-black">{statement.statementNumber}</div>
              <div className="mt-2 text-[12px] text-muted-foreground print:text-neutral-600">
                Generated {statement.generatedAt ? formatDate(statement.generatedAt) : "—"}
              </div>
            </div>
          </div>
        </header>

        <section className="mt-8 grid gap-8 border-b border-border/60 pb-8 print:border-neutral-300 md:grid-cols-2">
          <div>
            <div className="type-meta-accent print:text-neutral-700">
              Account holder
            </div>
            <p className="mt-2 text-[15px] font-medium print:text-black">{statement.ownerLabel}</p>
            <p className="mt-1 text-[13px] text-muted-foreground print:text-neutral-600">{statement.accountName}</p>
          </div>
          <div>
            <div className="type-meta-accent print:text-neutral-700">
              Account identifiers
            </div>
            <div className="mt-3 space-y-1 font-mono text-[12px] print:text-black">
              <p>Account {statement.accountNumber}</p>
              <p>Routing {statement.routingNumber}</p>
            </div>
          </div>
        </section>

        <section className="mt-8 border-b border-border/60 pb-8 print:border-neutral-300">
          <div className="type-meta-accent print:text-neutral-700">
            Statement period
          </div>
          <p className="mt-2 text-[15px] print:text-black">
            {formatDate(statement.periodStart)} – {formatDate(statement.periodEnd)}
          </p>
          {statement.openingBalanceEstimated && (
            <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground print:text-[11px] print:text-neutral-600">
              Opening balance derived from approved transaction history prior to this period. Immutable ledger
              snapshots will improve accuracy in a future release.
            </p>
          )}
        </section>

        <section className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Opening balance", florin(statement.openingBalance)],
            ["Closing balance", florin(statement.closingBalance)],
            ["Total deposits", florin(statement.totalDeposits)],
            ["Total withdrawals", florin(statement.totalWithdrawals)],
            ["Transfers in", florin(statement.totalTransfersIn)],
            ["Transfers out", florin(statement.totalTransfersOut)],
            ["Net change", `${statement.netChange >= 0 ? "+" : ""}${florin(statement.netChange)}`],
            ["Transactions", String(statement.transactionCount)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="statement-document__stat rounded-md border border-border/50 bg-surface-2/30 px-4 py-3 print:border-neutral-300 print:bg-transparent"
            >
              <div className="type-meta-sm print:text-neutral-600">
                {label}
              </div>
              <div className="mt-1 font-mono text-[14px] tabular-nums print:text-black">{value}</div>
            </div>
          ))}
        </section>

        <section className="statement-document__transactions mt-10">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold print:text-neutral-700">
            Transaction detail
          </div>
          {statement.transactions.length === 0 ? (
            <p className="mt-4 text-[13px] text-muted-foreground print:text-neutral-600">
              No approved transactions in this period.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto print:overflow-visible">
              <table className="w-full min-w-[560px] border-collapse text-[12px] print:text-[11px]">
                <thead>
                  <tr className="border-b border-border print:border-black">
                    <th className="py-2 text-left font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground print:text-neutral-600">
                      Date & time
                    </th>
                    <th className="py-2 text-left font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground print:text-neutral-600">
                      Description
                    </th>
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
                    const signedAmount = getSignedBankTransactionAmount(tx.type, tx.amount);
                    return (
                    <tr key={tx.id} className="statement-document__row border-b border-border/40 print:border-neutral-200">
                      <td className="py-2.5 text-muted-foreground print:text-neutral-600">
                        {formatActivityDateTime(tx.createdAt)}
                      </td>
                      <td className="py-2.5 print:text-black">{tx.description}</td>
                      <td className="py-2.5 font-mono text-[10px] print:text-black">{tx.referenceCode}</td>
                      <td className="py-2.5 text-right type-finance-nums print:text-black">
                        {signedAmount >= 0 ? "+" : "−"}
                        {florin(Math.abs(signedAmount))}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </article>
    </div>
  );
}
