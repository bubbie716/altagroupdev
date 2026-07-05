"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/page-shell";
import { OpsConfirmDialog } from "@/components/internal/ops-confirm-dialog";
import { StatusBadge } from "@/components/internal/status-badge";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { adminGrantCommercialProOps } from "@/lib/internal/commercial-admin.functions";

export type AdminCommercialPlanSummary = {
  commercialPlan: string;
  grantSource: string | null;
  expiresAt: string | null;
  billingStatus: string;
};

export function AdminCommercialProGrantPanel({
  companyId,
  companyName,
  commercialPlan,
}: {
  companyId: string;
  companyName: string;
  commercialPlan: AdminCommercialPlanSummary;
}) {
  const router = useRouter();
  const grantFn = useServerFn(adminGrantCommercialProOps);
  const [months, setMonths] = useState("3");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submitGrant(reason: string) {
    setError(null);
    setMessage(null);
    try {
      const result = await grantFn({
        data: {
          companyId,
          months: Number(months),
          reason,
        },
      });
      setMessage(
        `Granted Pro for ${result.monthsGranted} month(s) through ${formatActivityDateTime(result.expiresAt)}. ${result.memberCount} member(s) notified.`,
      );
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Grant failed.");
    }
  }

  const isAdminGrant = commercialPlan.grantSource === "ADMIN_GRANT";
  const isPro = commercialPlan.commercialPlan === "PRO";

  return (
    <Card className="!p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
        Alta Commercial Pro
      </div>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
        Grant complimentary Commercial Pro to {companyName}. All company members receive a Discord
        DM when Pro is granted. Billing is not charged during admin grants.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <MetaRow label="Current plan" value={<StatusBadge status={commercialPlan.commercialPlan} />} />
        <MetaRow
          label="Grant source"
          value={commercialPlan.grantSource?.replace("_", " ") ?? (isPro ? "Unknown" : "—")}
        />
        <MetaRow
          label="Expires"
          value={
            commercialPlan.expiresAt
              ? formatActivityDateTime(commercialPlan.expiresAt)
              : isAdminGrant
                ? "Not set"
                : "—"
          }
        />
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="text-xs text-muted-foreground">Duration (months)</span>
          <input
            type="number"
            min={1}
            max={120}
            step={1}
            value={months}
            onChange={(event) => setMonths(event.target.value)}
            className="mt-1 block w-32 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          className="rounded border border-gold/30 bg-gold/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold"
          onClick={() => setConfirmOpen(true)}
        >
          Grant Commercial Pro
        </button>
      </div>

      {message ? <p className="mt-4 text-[13px] text-muted-foreground">{message}</p> : null}
      {error ? <p className="mt-4 text-[13px] text-destructive">{error}</p> : null}

      <OpsConfirmDialog
        open={confirmOpen}
        title="Grant Alta Commercial Pro"
        description={`Grant ${companyName} Commercial Pro for ${months} month(s). This sends a Discord DM to every company member.`}
        confirmLabel="Grant Pro"
        onClose={() => setConfirmOpen(false)}
        onConfirm={async (reason) => {
          await submitGrant(reason);
          setConfirmOpen(false);
        }}
      />
    </Card>
  );
}

function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <div className="mt-2 text-[13px]">{value}</div>
    </div>
  );
}
