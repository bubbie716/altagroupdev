/** Plain-language labels for internal transaction records. */

const TYPE_TITLES: Record<string, string> = {
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  TRANSFER: "Transfer",
  ADJUSTMENT: "Account adjustment",
  INTEREST_CREDIT: "Interest credit",
  INTEREST_CHARGE: "Interest charge",
  LOAN_PAYMENT: "Loan payment",
  LOAN_DISBURSEMENT: "Loan disbursement",
  FEE: "Fee",
  ALTA_PAY: "Alta Pay",
};

export function plainTransactionTypeTitle(type: string, description?: string | null): string {
  const t = type.toUpperCase().replace(/\s+/g, "_");
  const desc = (description ?? "").toLowerCase();

  if (t === "WITHDRAWAL" && desc.includes("alta pay")) return "Alta Pay sent";
  if (t === "DEPOSIT" && desc.includes("alta pay")) return "Alta Pay received";
  if (t === "TRANSFER") {
    if (desc.includes("received") || desc.includes("incoming")) return "Transfer received";
    if (desc.includes("sent") || desc.includes("outgoing")) return "Transfer sent";
  }
  if (t === "ADJUSTMENT") {
    if (desc.includes("credit") || desc.includes("credit")) return "Account adjustment";
  }
  if (TYPE_TITLES[t]) return TYPE_TITLES[t];
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function transactionDirectionLabel(type: string, description?: string | null): string | null {
  const t = type.toUpperCase();
  const desc = (description ?? "").toLowerCase();
  if (t === "DEPOSIT" || t === "INTEREST_CREDIT" || t === "LOAN_DISBURSEMENT") return "Incoming";
  if (t === "WITHDRAWAL" || t === "LOAN_PAYMENT" || t === "INTEREST_CHARGE" || t === "FEE") {
    return "Outgoing";
  }
  if (t === "TRANSFER") {
    if (desc.includes("received") || desc.includes("incoming")) return "Incoming";
    if (desc.includes("sent") || desc.includes("outgoing")) return "Outgoing";
  }
  if (t === "ADJUSTMENT") {
    if (desc.includes("debit")) return "Outgoing";
    if (desc.includes("credit")) return "Incoming";
  }
  return null;
}

export function buildTransactionLifecycle(tx: {
  createdAt: string;
  status: string;
  reviewedAt?: string | null;
  reviewedByLabel?: string | null;
  reviewNote?: string | null;
}): Array<{ id: string; title: string; detail?: string; at: string }> {
  const events: Array<{ id: string; title: string; detail?: string; at: string }> = [
    { id: "submitted", title: "Submitted", at: tx.createdAt },
  ];
  const status = tx.status.toUpperCase();
  if (status === "PENDING") {
    events.push({ id: "pending", title: "Pending review", at: tx.createdAt });
  }
  if (tx.reviewedAt) {
    if (status === "APPROVED" || status === "COMPLETED" || status === "POSTED") {
      events.push({
        id: "approved",
        title: "Approved",
        detail: [tx.reviewedByLabel, tx.reviewNote].filter(Boolean).join(" · ") || undefined,
        at: tx.reviewedAt,
      });
      events.push({ id: "completed", title: "Completed", at: tx.reviewedAt });
    } else if (status === "DENIED" || status === "REJECTED") {
      events.push({
        id: "denied",
        title: "Denied",
        detail: [tx.reviewedByLabel, tx.reviewNote].filter(Boolean).join(" · ") || undefined,
        at: tx.reviewedAt,
      });
    } else if (status === "FAILED") {
      events.push({
        id: "failed",
        title: "Failed",
        detail: tx.reviewNote ?? undefined,
        at: tx.reviewedAt,
      });
    } else if (status === "REVERSED") {
      events.push({
        id: "reversed",
        title: "Reversed",
        detail: [tx.reviewedByLabel, tx.reviewNote].filter(Boolean).join(" · ") || undefined,
        at: tx.reviewedAt,
      });
    }
  } else if (status === "FAILED") {
    events.push({ id: "failed", title: "Failed", detail: tx.reviewNote ?? undefined, at: tx.createdAt });
  }
  return events;
}
