"use client";

import type { AltaCardAutopayContext } from "@/lib/bank/alta-card-autopay-types";

export function AltaCardAutopayStatusRow({
  autopayContext,
  autopayEnabled: autopayEnabledOverride,
  onManage,
}: {
  autopayContext?: AltaCardAutopayContext | null;
  /** When set (e.g. UI Lab overlay), overrides context settings.enabled. */
  autopayEnabled?: boolean;
  onManage?: () => void;
}) {
  const enabled =
    autopayEnabledOverride ?? autopayContext?.settings.enabled ?? false;
  const label = (
    <span className="text-[13px]">
      Autopay: <span className="font-medium">{enabled ? "On" : "Off"}</span>
    </span>
  );

  if (!onManage) {
    return (
      <div className="rounded-lg border border-border bg-surface-1/80 px-4 py-3">{label}</div>
    );
  }

  return (
    <button
      type="button"
      onClick={onManage}
      className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-1/80 px-4 py-3 text-left transition-colors hover:bg-surface-2/80"
    >
      {label}
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        Manage
      </span>
    </button>
  );
}
