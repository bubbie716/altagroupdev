import type { PaymentLinkStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { PAYMENT_LINK_STATUS_LABELS } from "@/lib/bank/payment-link-types";

const STATUS_CLASS: Record<PaymentLinkStatus, string> = {
  ACTIVE: "bg-[var(--success)]/12 text-[var(--success)]",
  PAUSED: "bg-gold/12 text-gold",
  EXPIRED: "bg-muted text-muted-foreground",
  COMPLETED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-destructive/10 text-destructive",
};

export function PaymentLinkStatusBadge({ status }: { status: PaymentLinkStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide",
        STATUS_CLASS[status],
      )}
    >
      {PAYMENT_LINK_STATUS_LABELS[status]}
    </span>
  );
}
