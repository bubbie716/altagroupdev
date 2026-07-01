import { Link } from "@tanstack/react-router";
import type { AltaCardRow, AltaCardStatementRow } from "@/lib/bank/alta-card-types";
import {
  formatAltaCardCurrency,
  ALTA_CARD_STATEMENT_STATUS_LABELS,
  isAltaCardCustomPeriodStatement,
} from "@/lib/bank/alta-card-types";
import { formatAltaCardBillingDate } from "@/lib/bank/alta-card-billing-cycle";
import { AdminDataTable, type AdminTableColumn } from "@/components/internal/admin-data-table";
import { altaCardStatementDetailLink } from "@/lib/bank/alta-card-navigation";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return formatAltaCardBillingDate(iso);
}

export type AltaCardStatementListKind = "official" | "activity" | "admin";

function statementColumns(
  card: Pick<AltaCardRow, "id" | "cardType" | "companyId">,
  listKind: AltaCardStatementListKind,
  statusLabels: Record<import("@/lib/bank/alta-card-types").AltaCardStatementStatusCode, string> = ALTA_CARD_STATEMENT_STATUS_LABELS,
): AdminTableColumn<AltaCardStatementRow>[] {
  const columns: AdminTableColumn<AltaCardStatementRow>[] = [
    {
      key: "number",
      header: listKind === "activity" ? "Summary" : "Statement",
      cell: (row) => (
        <span className="font-mono tabular-nums">#{row.statementNumber}</span>
      ),
    },
  ];

  if (listKind === "admin" || listKind === "activity") {
    columns.push({
      key: "period",
      header: "Period",
      cell: (row) =>
        `${formatDate(row.billingPeriodStart)} – ${formatDate(row.billingPeriodEnd)}`,
    });
  }

  if (listKind === "activity") {
    columns.push(
      {
        key: "endingBalance",
        header: "Period ending balance",
        cell: (row) => (
          <span className="font-mono tabular-nums">
            {formatAltaCardCurrency(row.endingBalance)}
          </span>
        ),
      },
      {
        key: "status",
        header: "Type",
        cell: (row) => statusLabels[row.status],
      },
      {
        key: "actions",
        header: "",
        cell: (row) => (
          <Link
            {...altaCardStatementDetailLink(card, row.id)}
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold"
          >
            View →
          </Link>
        ),
      },
    );
    return columns;
  }

  columns.push(
    {
      key: "statementDate",
      header: "Statement date",
      cell: (row) => formatDate(row.statementDate),
    },
    {
      key: "dueDate",
      header: "Due date",
      cell: (row) => formatDate(row.dueDate),
    },
    {
      key: "statementBalance",
      header: "Statement balance",
      cell: (row) => (
        <span className="font-mono tabular-nums">
          {formatAltaCardCurrency(row.statementBalance)}
        </span>
      ),
    },
    {
      key: "minimum",
      header: "Minimum",
      cell: (row) => (
        <span className="font-mono tabular-nums">
          {formatAltaCardCurrency(row.minimumPayment)}
        </span>
      ),
    },
  );

  if (listKind === "admin") {
    columns.push(
      {
        key: "amountPaid",
        header: "Amount paid",
        cell: (row) => (
          <span className="font-mono tabular-nums">
            {formatAltaCardCurrency(row.amountPaid)}
          </span>
        ),
      },
      {
        key: "remaining",
        header: "Remaining",
        cell: (row) => (
          <span className="font-mono tabular-nums">
            {formatAltaCardCurrency(row.remainingBalance)}
          </span>
        ),
      },
    );
  } else {
    columns.push({
      key: "balance",
      header: "Remaining",
      cell: (row) => (
        <span className="font-mono tabular-nums">
          {formatAltaCardCurrency(row.remainingBalance)}
        </span>
      ),
    });
  }

  columns.push(
    {
      key: "status",
      header: "Status",
      cell: (row) => statusLabels[row.status],
    },
    {
      key: "actions",
      header: "",
      cell: (row) => (
        <Link
          {...altaCardStatementDetailLink(card, row.id)}
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold"
        >
          View →
        </Link>
      ),
    },
  );

  return columns;
}

function StatementRowMobile({
  row,
  card,
  listKind,
}: {
  row: AltaCardStatementRow;
  card: Pick<AltaCardRow, "id" | "cardType" | "companyId">;
  listKind: AltaCardStatementListKind;
}) {
  const isActivity = listKind === "activity" || isAltaCardCustomPeriodStatement(row.status);

  return (
    <li className="border-b border-border/60 px-4 py-4 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[13px]">
            {isActivity ? "Summary" : "Statement"} #{row.statementNumber}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {isActivity
              ? `${formatDate(row.billingPeriodStart)} – ${formatDate(row.billingPeriodEnd)}`
              : `Due ${formatDate(row.dueDate)}`}
          </p>
        </div>
        <span className="text-[12px]">{ALTA_CARD_STATEMENT_STATUS_LABELS[row.status]}</span>
      </div>
      <dl className="mt-3 grid min-w-0 grid-cols-1 gap-2 text-[12px] min-[400px]:grid-cols-2">
        {isActivity ? (
          <div>
            <dt className="text-muted-foreground">Period ending balance</dt>
            <dd className="font-mono tabular-nums">{formatAltaCardCurrency(row.endingBalance)}</dd>
          </div>
        ) : (
          <>
            <div>
              <dt className="text-muted-foreground">Balance</dt>
              <dd className="font-mono tabular-nums">{formatAltaCardCurrency(row.remainingBalance)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Minimum</dt>
              <dd className="font-mono tabular-nums">{formatAltaCardCurrency(row.minimumPayment)}</dd>
            </div>
          </>
        )}
      </dl>
      <Link
        {...altaCardStatementDetailLink(card, row.id)}
        className="mt-3 inline-block font-mono text-[10px] uppercase tracking-[0.16em] text-gold"
      >
        View {isActivity ? "summary" : "statement"} →
      </Link>
    </li>
  );
}

export function AltaCardStatementList({
  cardId,
  card,
  statements,
  listKind = "official",
  statusLabels = ALTA_CARD_STATEMENT_STATUS_LABELS,
  emptyMessage,
}: {
  cardId: string;
  card: Pick<AltaCardRow, "id" | "cardType" | "companyId">;
  statements: AltaCardStatementRow[];
  listKind?: AltaCardStatementListKind;
  statusLabels?: Record<import("@/lib/bank/alta-card-types").AltaCardStatementStatusCode, string>;
  emptyMessage?: string;
}) {
  void cardId;

  if (statements.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-1/40 p-8 text-center">
        <p className="font-serif text-[20px] tracking-tight">
          {listKind === "activity" ? "No activity summaries yet" : "No official statements yet"}
        </p>
        <p className="mt-2 text-[13px] text-muted-foreground">
          {emptyMessage ??
            (listKind === "activity"
              ? "Generate a custom date range above for a read-only transaction summary."
              : "Your official billing statement is issued automatically at the end of each billing cycle.")}
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface-1/80 md:hidden">
        {statements.map((row) => (
          <StatementRowMobile key={row.id} row={row} card={card} listKind={listKind} />
        ))}
      </ul>
      <div className="hidden min-w-0 max-w-full md:block">
        <AdminDataTable
          columns={statementColumns(card, listKind, statusLabels)}
          rows={statements}
          rowKey={(row) => row.id}
        />
      </div>
    </>
  );
}
