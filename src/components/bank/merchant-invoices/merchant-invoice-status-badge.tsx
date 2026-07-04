import type { MerchantInvoiceStatus } from "@prisma/client";

const STATUS_LABELS: Record<MerchantInvoiceStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  VIEWED: "Viewed",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
  VOIDED: "Voided",
};

const STATUS_CLASS: Record<MerchantInvoiceStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  VIEWED: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  PARTIALLY_PAID: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  PAID: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  OVERDUE: "bg-red-500/10 text-red-700 dark:text-red-300",
  CANCELLED: "bg-muted text-muted-foreground",
  VOIDED: "bg-muted text-muted-foreground line-through",
};

export function MerchantInvoiceStatusBadge({ status }: { status: MerchantInvoiceStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function merchantInvoiceStatusLabel(status: MerchantInvoiceStatus): string {
  return STATUS_LABELS[status];
}
