"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/page-shell";
import { StatusBadge } from "@/components/internal/status-badge";
import { OpsConfirmDialog } from "@/components/internal/ops-confirm-dialog";
import { formatActivityDateTime } from "@/lib/format-datetime";
import type { CreditDeskSettings, CreditDeskStatus } from "@/lib/platform/credit-desk-types";
import { setCreditDeskStatusOps } from "@/lib/platform/platform-settings.functions";
import { invalidateCreditDeskNavCache } from "@/hooks/use-credit-desk-nav";

export function CreditDeskPanel({ initial }: { initial: CreditDeskSettings }) {
  const router = useRouter();
  const saveFn = useServerFn(setCreditDeskStatusOps);
  const [status, setStatus] = useState<CreditDeskStatus>(initial.status);
  const [confirmAction, setConfirmAction] = useState<null | CreditDeskStatus>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStatus(initial.status);
  }, [initial.status]);

  async function refreshSettings() {
    await router.invalidate();
  }

  const isClosed = status === "closed";

  return (
    <Card className="!p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">Credit Desk</div>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            Temporarily stop new credit applications — personal loans, business loans, private liquidity
            lines, Alta Card applications, and account review requests. Closing the Credit Desk also
            cancels all pending applications and reviews. Existing loans, Alta Cards, payments, and
            autopay remain active.
          </p>
        </div>
        <StatusBadge status={isClosed ? "Closed" : "Open"} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <MetaRow label="Credit Desk status" value={isClosed ? "Closed" : "Open"} />
        <MetaRow
          label="Closed since"
          value={initial.closedAt ? formatActivityDateTime(initial.closedAt) : "—"}
        />
        <MetaRow label="Last updated by" value={initial.updatedByUsername ?? "—"} />
        <MetaRow
          label="Last updated"
          value={initial.updatedAt ? formatActivityDateTime(initial.updatedAt) : "—"}
        />
      </div>

      {error ? <p className="mt-4 text-[13px] text-destructive">{error}</p> : null}

      <div className="mt-6">
        {initial.canEdit ? (
          <div className="flex flex-wrap gap-2">
            {!isClosed ? (
              <button
                type="button"
                className="rounded border border-destructive/30 bg-destructive/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-destructive"
                onClick={() => setConfirmAction("closed")}
              >
                Close Credit Desk
              </button>
            ) : (
              <button
                type="button"
                className="rounded border border-gold/30 bg-gold/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold"
                onClick={() => setConfirmAction("open")}
              >
                Open Credit Desk
              </button>
            )}
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">
            Only admins can change Credit Desk status. Operators can view current status.
          </p>
        )}
      </div>

      <OpsConfirmDialog
        open={confirmAction === "closed"}
        title="Close Credit Desk"
        description="New credit applications will be blocked and all pending lending applications, Alta Card applications, and account reviews will be cancelled. Existing loans, Alta Cards, payments, and autopay are not affected."
        confirmLabel="Close Credit Desk"
        variant="danger"
        onCancel={() => setConfirmAction(null)}
        onConfirm={async (reason) => {
          setError(null);
          try {
            await saveFn({ data: { status: "closed", reason } });
            setStatus("closed");
            invalidateCreditDeskNavCache();
            setConfirmAction(null);
            await refreshSettings();
          } catch (e) {
            setError(e instanceof Error ? e.message.replace(/^BAD_REQUEST:/, "") : "Update failed.");
            throw e;
          }
        }}
      />

      <OpsConfirmDialog
        open={confirmAction === "open"}
        title="Open Credit Desk"
        description="Customers will be able to submit new credit applications again."
        confirmLabel="Open Credit Desk"
        onCancel={() => setConfirmAction(null)}
        onConfirm={async (reason) => {
          setError(null);
          try {
            await saveFn({ data: { status: "open", reason } });
            setStatus("open");
            invalidateCreditDeskNavCache();
            setConfirmAction(null);
            await refreshSettings();
          } catch (e) {
            setError(e instanceof Error ? e.message.replace(/^BAD_REQUEST:/, "") : "Update failed.");
            throw e;
          }
        }}
      />
    </Card>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 px-4 py-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-[13px] text-foreground">{value}</div>
    </div>
  );
}
