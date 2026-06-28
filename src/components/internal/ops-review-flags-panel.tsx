"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { OpsReviewFlagReasonCode, OpsReviewFlagRow, OpsReviewFlagTargetType } from "@/lib/internal/ops-review-flag.types";
import { OPS_REVIEW_FLAG_REASONS, OPS_REVIEW_FLAG_REASON_LABELS } from "@/lib/internal/ops-review-flag.types";
import { createOpsReviewFlagOps, resolveOpsReviewFlagOps } from "@/lib/internal/ops-v1.functions";
import { OpsAction } from "@/components/internal/ops-action";
import { OpsStatusBadge } from "@/components/internal/console/ops-status-badge";
import { formatActivityDateTime } from "@/lib/format-datetime";

export function OpsReviewFlagsPanel({
  targetType,
  targetId,
  initialFlags,
}: {
  targetType: OpsReviewFlagTargetType;
  targetId: string;
  initialFlags: OpsReviewFlagRow[];
}) {
  const router = useRouter();
  const createFn = useServerFn(createOpsReviewFlagOps);
  const resolveFn = useServerFn(resolveOpsReviewFlagOps);
  const [reasonCode, setReasonCode] = useState<OpsReviewFlagReasonCode>("MANUAL_REVIEW");
  const [customReason, setCustomReason] = useState("");

  const active = initialFlags.filter((f) => f.status === "ACTIVE");

  return (
    <div className="space-y-4">
      {active.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">No active review flags on this record.</p>
      ) : (
        <ul className="space-y-2">
          {active.map((flag) => (
            <li key={flag.id} className="rounded border border-amber-400/30 bg-amber-400/5 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <OpsStatusBadge status={flag.reasonLabel} tone="warning" />
                <span className="font-mono text-[10px] text-muted-foreground">
                  {flag.createdByUsername} · {formatActivityDateTime(flag.createdAt)}
                </span>
              </div>
              <div className="mt-2">
                <OpsAction
                  label="Resolve flag"
                  variant="default"
                  title="Resolve operational review flag"
                  description="Mark this flag as resolved. The record is not blocked — this closes the review indicator."
                  confirmLabel="Resolve flag"
                  onConfirm={async (reason) => {
                    await resolveFn({ data: { flagId: flag.id, reason } });
                    void router.invalidate();
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded border border-border/60 p-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Add review flag
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <select
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value as OpsReviewFlagReasonCode)}
            className="rounded border border-border bg-background px-2 py-1 text-[12px]"
          >
            {OPS_REVIEW_FLAG_REASONS.map((r) => (
              <option key={r} value={r}>
                {OPS_REVIEW_FLAG_REASON_LABELS[r]}
              </option>
            ))}
          </select>
          {reasonCode === "CUSTOM" ? (
            <input
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Custom reason"
              className="min-w-[160px] flex-1 rounded border border-border bg-background px-2 py-1 text-[12px]"
            />
          ) : null}
          <OpsAction
            label="Add flag"
            variant="danger"
            title="Add operational review flag"
            description="Flags are visible to operators only. They do not block customer actions."
            impact={`${OPS_REVIEW_FLAG_REASON_LABELS[reasonCode]} on ${targetType.replace(/_/g, " ")}`}
            confirmLabel="Add flag"
            disabled={reasonCode === "CUSTOM" && !customReason.trim()}
            onConfirm={async (note) => {
              await createFn({
                data: {
                  targetType,
                  targetId,
                  reason: reasonCode,
                  customReason: reasonCode === "CUSTOM" ? customReason : undefined,
                  note,
                },
              });
              setCustomReason("");
              void router.invalidate();
            }}
          />
        </div>
      </div>
    </div>
  );
}
