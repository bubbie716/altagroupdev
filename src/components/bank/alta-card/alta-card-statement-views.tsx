import { Link } from "@tanstack/react-router";
import type { AltaCardRow, AltaCardStatementRow } from "@/lib/bank/alta-card-types";
import { formatAltaCardCurrency } from "@/lib/bank/alta-card-types";
import { ALTA_CARD_STATEMENT_STATUS_LABELS } from "@/lib/bank/alta-card-types";
import { AdminDataTable, type AdminTableColumn } from "@/components/internal/admin-data-table";
import {
  altaCardStatementDetailLink,
  altaCardStatementsLink,
} from "@/lib/bank/alta-card-navigation";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statementColumns(
  card: Pick<AltaCardRow, "id" | "cardType" | "companyId">,
  variant: "default" | "admin" = "default",
  statusLabels: Record<import("@/lib/bank/alta-card-types").AltaCardStatementStatusCode, string> = ALTA_CARD_STATEMENT_STATUS_LABELS,
): AdminTableColumn<AltaCardStatementRow>[] {
  const columns: AdminTableColumn<AltaCardStatementRow>[] = [
    {
      key: "number",
      header: "Statement",
      cell: (row) => (
        <span className="font-mono tabular-nums">#{row.statementNumber}</span>
      ),
    },
  ];

  if (variant === "admin") {
    columns.push({
      key: "period",
      header: "Billing period",
      cell: (row) =>
        `${formatDate(row.billingPeriodStart)} – ${formatDate(row.billingPeriodEnd)}`,
    });
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

  if (variant === "admin") {
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
}: {
  row: AltaCardStatementRow;
  card: Pick<AltaCardRow, "id" | "cardType" | "companyId">;
}) {
  return (
    <li className="border-b border-border/60 px-4 py-4 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[13px]">Statement #{row.statementNumber}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Due {formatDate(row.dueDate)}
          </p>
        </div>
        <span className="text-[12px]">{ALTA_CARD_STATEMENT_STATUS_LABELS[row.status]}</span>
      </div>
      <dl className="mt-3 grid min-w-0 grid-cols-1 gap-2 text-[12px] min-[400px]:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Balance</dt>
          <dd className="font-mono tabular-nums">{formatAltaCardCurrency(row.remainingBalance)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Minimum</dt>
          <dd className="font-mono tabular-nums">{formatAltaCardCurrency(row.minimumPayment)}</dd>
        </div>
      </dl>
      <Link
        {...altaCardStatementDetailLink(card, row.id)}
        className="mt-3 inline-block font-mono text-[10px] uppercase tracking-[0.16em] text-gold"
      >
        View statement →
      </Link>
    </li>
  );
}

export function AltaCardStatementList({
  cardId,
  card,
  statements,
  variant = "default",
  statusLabels = ALTA_CARD_STATEMENT_STATUS_LABELS,
}: {
  cardId: string;
  card: Pick<AltaCardRow, "id" | "cardType" | "companyId">;
  statements: AltaCardStatementRow[];
  variant?: "default" | "admin";
  statusLabels?: Record<import("@/lib/bank/alta-card-types").AltaCardStatementStatusCode, string>;
}) {
  if (statements.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-1/40 p-8 text-center">
        <p className="font-serif text-[20px] tracking-tight">No statements yet</p>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Your first statement will appear after your billing cycle closes.
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface-1/80 md:hidden">
        {statements.map((row) => (
          <StatementRowMobile key={row.id} row={row} card={card} />
        ))}
      </ul>
      <div className="hidden min-w-0 max-w-full md:block">
        <AdminDataTable
          columns={statementColumns(card, variant, statusLabels)}
          rows={statements}
          rowKey={(row) => row.id}
        />
      </div>
    </>
  );
}
