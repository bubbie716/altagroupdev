/** Plain-language Terminal crypto ops labels (operators — not customer surface). */

export function cryptoOpsStatusLabel(status: string): string {
  switch (status) {
    case "DRAFT":
      return "Draft";
    case "ACTIVE":
      return "Active";
    case "HALTED":
      return "Trading halted";
    case "REDEMPTION_ONLY":
      return "Redemption only";
    case "CLOSED":
      return "Closed";
    default:
      return status;
  }
}

export function cryptoOpsKindLabel(kind: string): string {
  if (kind === "STABLE") return "Stable coin";
  if (kind === "BONDING_CURVE") return "Bonding curve";
  return kind;
}

export function cryptoOpsSeverityLabel(severity: string): string {
  switch (severity) {
    case "CRITICAL":
      return "Critical";
    case "WARNING":
      return "Warning";
    case "INFO":
      return "Info";
    default:
      return severity;
  }
}

export function cryptoOpsJobsStatusLabel(status: string): string {
  switch (status) {
    case "ready":
      return "Ready";
    case "attention":
      return "Needs attention";
    case "not_configured":
      return "Not configured";
    default:
      return status;
  }
}

export function newCryptoOpsIdempotencyKey(prefix: string): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${rand}`;
}

export function cryptoOpsAttentionCta(item: {
  kind: string;
  severity: string;
}): { label: string; tab: "overview" | "readiness" | "integrity" | "activity" } {
  switch (item.kind) {
    case "reconciliation":
    case "reconciliation_issue":
      return { label: "Review reconciliation issue", tab: "integrity" };
    case "readiness":
    case "activation":
      return { label: "Review asset readiness", tab: "readiness" };
    case "job":
    case "failed_job":
      return { label: "Review failed job", tab: "activity" };
    case "lifecycle":
    case "status":
      return { label: "Review asset readiness", tab: "overview" };
    case "configuration":
      return { label: "Review asset readiness", tab: "overview" };
    default:
      if (item.severity === "CRITICAL" || item.severity === "WARNING") {
        return { label: "Review reconciliation issue", tab: "integrity" };
      }
      return { label: "Review asset readiness", tab: "overview" };
  }
}
