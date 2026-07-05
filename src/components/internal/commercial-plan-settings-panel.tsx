"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/page-shell";
import { OpsConfirmDialog } from "@/components/internal/ops-confirm-dialog";
import { formatActivityDateTime } from "@/lib/format-datetime";
import type { CommercialPlatformSettingsView } from "@/lib/platform/commercial-plan-settings-types";
import { setCommercialPlanPlatformSettingsOps } from "@/lib/platform/platform-settings.functions";

export function CommercialPlanSettingsPanel({
  initial,
}: {
  initial: CommercialPlatformSettingsView;
}) {
  const router = useRouter();
  const saveFn = useServerFn(setCommercialPlanPlatformSettingsOps);
  const [values, setValues] = useState({
    proMonthlyFee: String(initial.proMonthlyFee),
    coreInvoiceMonthlyLimit: String(initial.coreInvoiceMonthlyLimit),
    corePaymentLinkMonthlyLimit: String(initial.corePaymentLinkMonthlyLimit),
    coreTeamMemberLimit: String(initial.coreTeamMemberLimit),
    proBillingGracePeriodDays: String(initial.proBillingGracePeriodDays),
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValues({
      proMonthlyFee: String(initial.proMonthlyFee),
      coreInvoiceMonthlyLimit: String(initial.coreInvoiceMonthlyLimit),
      corePaymentLinkMonthlyLimit: String(initial.corePaymentLinkMonthlyLimit),
      coreTeamMemberLimit: String(initial.coreTeamMemberLimit),
      proBillingGracePeriodDays: String(initial.proBillingGracePeriodDays),
    });
  }, [initial]);

  async function save(reason: string) {
    setError(null);
    try {
      await saveFn({
        data: {
          proMonthlyFee: Number(values.proMonthlyFee),
          coreInvoiceMonthlyLimit: Number(values.coreInvoiceMonthlyLimit),
          corePaymentLinkMonthlyLimit: Number(values.corePaymentLinkMonthlyLimit),
          coreTeamMemberLimit: Number(values.coreTeamMemberLimit),
          proBillingGracePeriodDays: Number(values.proBillingGracePeriodDays),
          reason,
        },
      });
      await router.invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Save failed.");
    }
  }

  return (
    <Card className="!p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
        Alta Commercial plans
      </div>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
        Configure Alta Commercial Core limits and Commercial Pro monthly billing. New Pro purchases
        and renewals use these values.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Field
          label="Commercial Pro monthly fee"
          value={values.proMonthlyFee}
          onChange={(value) => setValues((prev) => ({ ...prev, proMonthlyFee: value }))}
          disabled={!initial.canEdit}
        />
        <Field
          label="Core invoice monthly limit"
          value={values.coreInvoiceMonthlyLimit}
          onChange={(value) => setValues((prev) => ({ ...prev, coreInvoiceMonthlyLimit: value }))}
          disabled={!initial.canEdit}
        />
        <Field
          label="Core payment link monthly limit"
          value={values.corePaymentLinkMonthlyLimit}
          onChange={(value) =>
            setValues((prev) => ({ ...prev, corePaymentLinkMonthlyLimit: value }))
          }
          disabled={!initial.canEdit}
        />
        <Field
          label="Core team member limit"
          value={values.coreTeamMemberLimit}
          onChange={(value) => setValues((prev) => ({ ...prev, coreTeamMemberLimit: value }))}
          disabled={!initial.canEdit}
        />
        <Field
          label="Pro billing grace period (days)"
          value={values.proBillingGracePeriodDays}
          onChange={(value) =>
            setValues((prev) => ({ ...prev, proBillingGracePeriodDays: value }))
          }
          disabled={!initial.canEdit}
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <MetaRow label="Last updated by" value={initial.updatedByUsername ?? "—"} />
        <MetaRow
          label="Last updated"
          value={initial.updatedAt ? formatActivityDateTime(initial.updatedAt) : "—"}
        />
      </div>

      {error ? <p className="mt-4 text-[13px] text-destructive">{error}</p> : null}

      {initial.canEdit ? (
        <button
          type="button"
          className="mt-6 rounded border border-gold/30 bg-gold/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold"
          onClick={() => setConfirmOpen(true)}
        >
          Save commercial plan settings
        </button>
      ) : null}

      <OpsConfirmDialog
        open={confirmOpen}
        title="Save commercial plan settings"
        description="This updates Core limits and the Commercial Pro monthly fee for all companies."
        confirmLabel="Save settings"
        onClose={() => setConfirmOpen(false)}
        onConfirm={async (reason) => {
          await save(reason);
          setConfirmOpen(false);
        }}
      />
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type="number"
        min="0"
        step="1"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
      />
    </label>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <p className="mt-2 text-[13px]">{value}</p>
    </div>
  );
}
