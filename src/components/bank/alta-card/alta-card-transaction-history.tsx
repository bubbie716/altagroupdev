import type { AltaCardTransactionRow } from "@/lib/bank/alta-card-types";
import {
  altaCardEmployeeTransactionAttribution,
  altaCardTransactionLabel,
  altaCardTransactionSignedAmount,
  formatAltaCardCurrency,
} from "@/lib/bank/alta-card-types";
import { AdminDataTable, type AdminTableColumn } from "@/components/internal/admin-data-table";

function TransactionDescription({ row }: { row: AltaCardTransactionRow }) {
  const employeeAttribution = altaCardEmployeeTransactionAttribution(row);

  return (
    <div className="min-w-0">
      <p className="break-words">{row.description}</p>
      {employeeAttribution ? (
        <p className="text-[11px] text-muted-foreground">{employeeAttribution}</p>
      ) : null}
      {!employeeAttribution && row.merchantCompanyName ? (
        <p className="text-[11px] text-muted-foreground">{row.merchantCompanyName}</p>
      ) : null}
    </div>
  );
}

function TransactionRowMobile({ row }: { row: AltaCardTransactionRow }) {
  const signed = altaCardTransactionSignedAmount(row.type, row.amount);
  const prefix = signed > 0 ? "+" : signed < 0 ? "−" : "";
  const employeeAttribution = altaCardEmployeeTransactionAttribution(row);

  return (
    <li className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-[13px] font-medium">{altaCardTransactionLabel(row.type)}</p>
        <p className="break-words text-[12px] text-muted-foreground">{row.description}</p>
        {employeeAttribution ? (
          <p className="mt-1 text-[11px] text-muted-foreground">{employeeAttribution}</p>
        ) : null}
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          {new Date(row.createdAt).toLocaleDateString()}
        </p>
      </div>
      <span className="shrink-0 font-mono text-[14px] tabular-nums">
        {prefix}
        {formatAltaCardCurrency(Math.abs(row.amount))}
      </span>
    </li>
  );
}

function transactionColumns(): AdminTableColumn<AltaCardTransactionRow>[] {
  return [
    {
      key: "date",
      header: "Date",
      cell: (row) => new Date(row.createdAt).toLocaleString(),
    },
    {
      key: "type",
      header: "Type",
      cell: (row) => altaCardTransactionLabel(row.type),
    },
    {
      key: "description",
      header: "Description",
      cell: (row) => <TransactionDescription row={row} />,
    },
    {
      key: "spender",
      header: "Spender",
      cell: (row) => row.spenderUsername ?? "—",
    },
    {
      key: "amount",
      header: "Amount",
      cell: (row) => {
        const signed = altaCardTransactionSignedAmount(row.type, row.amount);
        const prefix = signed > 0 ? "+" : signed < 0 ? "−" : "";
        return (
          <span className="font-mono tabular-nums">
            {prefix}
            {formatAltaCardCurrency(Math.abs(row.amount))}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => row.status,
    },
    {
      key: "ref",
      header: "Reference",
      cell: (row) => (
        <span className="font-mono text-[10px]">{row.referenceCode}</span>
      ),
    },
  ];
}

export function AltaCardTransactionHistory({
  transactions,
  title = "Transaction history",
  description,
  limit,
}: {
  transactions: AltaCardTransactionRow[];
  title?: string;
  description?: string;
  limit?: number;
}) {
  const rows = limit != null ? transactions.slice(0, limit) : transactions;

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface-1/40 p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </p>
        <p className="mt-2 text-[13px] text-muted-foreground">No transactions yet.</p>
      </div>
    );
  }

  return (
    <section className="min-w-0 space-y-3">
      <div>
        <h3 className="font-serif text-[18px]">{title}</h3>
        {description ? (
          <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
        ) : null}
      </div>

      <ul className="overflow-hidden rounded-xl border border-border bg-surface-1/80 md:hidden">
        {rows.map((row) => (
          <TransactionRowMobile key={row.id} row={row} />
        ))}
      </ul>

      <div className="hidden min-w-0 max-w-full md:block">
        <AdminDataTable columns={transactionColumns()} rows={rows} rowKey={(row) => row.id} />
      </div>
    </section>
  );
}
