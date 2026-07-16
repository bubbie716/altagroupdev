import { cn } from "@/lib/utils";

export type PortalStatusKind =
  | "institution"
  | "routing"
  | "settlement"
  | "member"
  | "severity"
  | "generic";

const SETTLEMENT_STYLES: Record<string, string> = {
  CREATED: "bg-[#f3f4f6] text-[#4b5563] border-[#e5e7eb]",
  SUBMITTED: "bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]",
  VALIDATING: "bg-[#fefce8] text-[#a16207] border-[#fef08a]",
  QUEUED: "bg-[#fefce8] text-[#a16207] border-[#fef08a]",
  SETTLING: "bg-[#e8f2ed] text-[#0c4d32] border-[#bbf7d0]",
  SETTLED: "bg-[#ecfdf3] text-[#15803d] border-[#bbf7d0]",
  FAILED: "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]",
  CANCELLED: "bg-[#f3f4f6] text-[#6b7280] border-[#e5e7eb]",
  REVERSED: "bg-[#f5f3ff] text-[#6d28d9] border-[#ddd6fe]",
};

const INSTITUTION_STYLES: Record<string, string> = {
  APPLICANT: "bg-[#fefce8] text-[#a16207] border-[#fef08a]",
  ACTIVE: "bg-[#ecfdf3] text-[#15803d] border-[#bbf7d0]",
  RESTRICTED: "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]",
  SUSPENDED: "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]",
  TERMINATED: "bg-[#f3f4f6] text-[#6b7280] border-[#e5e7eb]",
  INACTIVE: "bg-[#f3f4f6] text-[#6b7280] border-[#e5e7eb]",
};

const ROUTING_STYLES: Record<string, string> = {
  RESERVED: "bg-[#f3f4f6] text-[#4b5563] border-[#e5e7eb]",
  ACTIVE: "bg-[#ecfdf3] text-[#15803d] border-[#bbf7d0]",
  SUSPENDED: "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]",
  RETIRED: "bg-[#f3f4f6] text-[#6b7280] border-[#e5e7eb]",
  INACTIVE: "bg-[#f3f4f6] text-[#6b7280] border-[#e5e7eb]",
};

const SEVERITY_STYLES: Record<string, string> = {
  info: "bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]",
  warning: "bg-[#fefce8] text-[#a16207] border-[#fef08a]",
  critical: "bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]",
};

function styleFor(kind: PortalStatusKind, status: string): string {
  const key = status.toUpperCase();
  if (kind === "settlement") return SETTLEMENT_STYLES[key] ?? SETTLEMENT_STYLES.CREATED;
  if (kind === "institution") return INSTITUTION_STYLES[key] ?? INSTITUTION_STYLES.INACTIVE;
  if (kind === "routing") return ROUTING_STYLES[key] ?? ROUTING_STYLES.RESERVED;
  if (kind === "severity") return SEVERITY_STYLES[status.toLowerCase()] ?? SEVERITY_STYLES.info;
  if (kind === "member") {
    return status === "ACTIVE"
      ? INSTITUTION_STYLES.ACTIVE
      : INSTITUTION_STYLES.INACTIVE;
  }
  return "bg-[#f3f4f6] text-[#4b5563] border-[#e5e7eb]";
}

function labelFor(status: string): string {
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function PortalStatusBadge({
  status,
  kind = "generic",
  className,
}: {
  status: string;
  kind?: PortalStatusKind;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
        styleFor(kind, status),
        className,
      )}
    >
      {labelFor(status)}
    </span>
  );
}

export function formatPortalMoney(amount: number, currency = "FLR"): string {
  const formatted = amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === "FLR" ? `ƒ ${formatted}` : `${currency} ${formatted}`;
}

export function formatPortalDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDurationMs(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}
