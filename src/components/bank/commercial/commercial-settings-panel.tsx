"use client";

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/page-shell";
import type { CommercialBillingAccountOption } from "@/lib/bank/commercial-billing-types";
import type { CommercialSettingsView } from "@/lib/bank/commercial-banking-types";
import {
  COMMERCIAL_PLAN_DESCRIPTIONS,
  COMMERCIAL_PLAN_LABELS,
} from "@/lib/bank/commercial-banking-types";
import { florin } from "@/lib/bank/api";
import { formatActivityDateTime } from "@/lib/format-datetime";
import {
  fetchCommercialBillingAccounts,
  fetchCommercialBillingPreview,
  purchaseCommercialProPlan,
  updateCommercialBillingAccountFn,
} from "@/lib/bank/commercial-banking.functions";

export function CommercialSettingsPanel({
  settings,
  accountId,
  onUpdated,
}: {
  settings: CommercialSettingsView;
  accountId: string;
  onUpdated: () => void;
}) {
  const fetchPreview = useServerFn(fetchCommercialBillingPreview);
  const fetchAccounts = useServerFn(fetchCommercialBillingAccounts);
  const purchasePro = useServerFn(purchaseCommercialProPlan);
  const updateBillingAccount = useServerFn(updateCommercialBillingAccountFn);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [billingAccountId, setBillingAccountId] = useState(
    settings.billingAccountId ?? "",
  );
  const [billingAccounts, setBillingAccounts] = useState<CommercialBillingAccountOption[]>([]);
  const [preview, setPreview] = useState<Awaited<
    ReturnType<typeof fetchCommercialBillingPreview>
  > | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isPro = settings.commercialPlan === "PRO";
  const usage = settings.usage;

  useEffect(() => {
    if (!settings.canManageBillingAccount) return;
    void fetchAccounts({ data: settings.companyId })
      .then((rows) => {
        setBillingAccounts(rows);
        if (!billingAccountId && rows[0]) setBillingAccountId(rows[0].id);
      })
      .catch(() => undefined);
  }, [settings.canManageBillingAccount, settings.companyId, fetchAccounts, billingAccountId]);

  async function openUpgradeConfirm() {
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      const nextPreview = await fetchPreview({
        data: {
          companyId: settings.companyId,
          billingAccountId: billingAccountId || undefined,
        },
      });
      setPreview(nextPreview);
      setBillingAccountId(nextPreview.billingAccount?.id ?? billingAccountId);
      setConfirmOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load billing preview.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmPurchase() {
    if (!preview?.billingAccount?.id) {
      setError("Select a billing account.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await purchasePro({
        data: {
          companyId: settings.companyId,
          billingAccountId: preview.billingAccount.id,
        },
      });
      setConfirmOpen(false);
      setMessage(
        `Alta Commercial Pro activated. First charge ${florin(result.monthlyFee)} · ${result.referenceCode}`,
      );
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed.");
    } finally {
      setSaving(false);
    }
  }

  async function saveBillingAccount() {
    if (!billingAccountId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateBillingAccount({
        data: { companyId: settings.companyId, billingAccountId },
      });
      setMessage("Billing account updated.");
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update billing account.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="!p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
          Commercial plan
        </p>
        <h3 className="mt-2 text-lg font-medium tracking-tight">{settings.companyName}</h3>
        <p className="mt-2 text-[13px] text-muted-foreground">
          {COMMERCIAL_PLAN_DESCRIPTIONS[settings.commercialPlan]}
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-foreground bg-surface-2/50 p-5">
            <p className="font-medium">{COMMERCIAL_PLAN_LABELS[settings.commercialPlan]}</p>
            <p className="mt-2 text-[13px] text-muted-foreground">
              {isPro
                ? settings.grantSource === "ADMIN_GRANT"
                  ? settings.expiresAt
                    ? `Complimentary Pro through ${formatActivityDateTime(settings.expiresAt)}`
                    : "Complimentary Pro"
                  : settings.monthlyFee != null
                    ? `${florin(settings.monthlyFee)} / month`
                    : "Active Pro subscription"
                : "Free business banking with Core limits"}
            </p>
            {settings.billingStatus === "PAST_DUE" ? (
              <p className="mt-3 text-[13px] text-destructive">
                Billing is past due. Add funds to your billing account to avoid downgrade.
              </p>
            ) : null}
          </div>
          {!isPro && settings.canPurchasePro ? (
            <div className="rounded-lg border border-border p-5">
              <p className="font-medium">Upgrade to Pro</p>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                Unlimited invoices, payment links, and team members. Advanced analytics, payroll,
                custom branding, and priority support.
              </p>
              <button
                type="button"
                disabled={saving}
                onClick={() => void openUpgradeConfirm()}
                className="mt-4 inline-flex rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-60"
              >
                Upgrade to Pro
              </button>
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="!p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
          Usage & limits
        </p>
        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <UsageRow
            label="Invoices this month"
            value={usage.invoicesThisMonth}
            limit={usage.isPro ? null : usage.limits.coreInvoiceMonthlyLimit}
          />
          <UsageRow
            label="Active payment links"
            value={usage.activePaymentLinks}
            limit={usage.isPro ? null : usage.limits.coreActivePaymentLinkLimit}
          />
          <UsageRow
            label="Team members"
            value={usage.teamMembers}
            limit={usage.isPro ? null : usage.limits.coreTeamMemberLimit}
          />
        </dl>
      </Card>

      {isPro ? (
        <Card className="!p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">Billing</p>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Billing status</dt>
              <dd className="mt-1 text-sm font-medium">{settings.billingStatus}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Monthly fee</dt>
              <dd className="mt-1 text-sm font-medium">
                {settings.monthlyFee != null ? florin(settings.monthlyFee) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Next billing date</dt>
              <dd className="mt-1 text-sm font-medium">
                {settings.nextBillingAt
                  ? formatActivityDateTime(settings.nextBillingAt)
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Pro since</dt>
              <dd className="mt-1 text-sm font-medium">
                {settings.proSubscribedAt
                  ? formatActivityDateTime(settings.proSubscribedAt)
                  : "—"}
              </dd>
            </div>
          </dl>
          {settings.canManageBillingAccount && billingAccounts.length > 0 ? (
            <div className="mt-6 flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="text-xs text-muted-foreground">Billing account</span>
                <select
                  value={billingAccountId}
                  onChange={(event) => setBillingAccountId(event.target.value)}
                  className="mt-1 block min-w-[16rem] rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  {billingAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.accountName} · {account.accountNumber} ·{" "}
                      {florin(account.availableBalance)} available
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={saving || !billingAccountId}
                onClick={() => void saveBillingAccount()}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium"
              >
                Update billing account
              </button>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card className="!p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
          Enabled features
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {settings.enabledFeatures.map((feature) => (
            <li key={feature} className="flex items-center justify-between gap-3">
              <span className="capitalize">{feature.replace(/_/g, " ")}</span>
              <span className="text-xs text-muted-foreground">Active</span>
            </li>
          ))}
        </ul>
      </Card>

      {confirmOpen && preview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg !p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
              Confirm upgrade
            </p>
            <h3 className="mt-2 text-lg font-medium">Upgrade to Alta Commercial Pro</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="Current plan" value={COMMERCIAL_PLAN_LABELS[preview.currentPlan]} />
              <Row label="New plan" value={COMMERCIAL_PLAN_LABELS[preview.targetPlan]} />
              <Row label="Monthly fee" value={florin(preview.monthlyFee)} />
              <Row
                label="Next billing date"
                value={formatActivityDateTime(preview.nextBillingDate)}
              />
            </dl>
            <label className="mt-6 block text-sm">
              <span className="text-muted-foreground">Billing account</span>
              <select
                value={preview.billingAccount?.id ?? ""}
                onChange={(event) => {
                  const id = event.target.value;
                  setBillingAccountId(id);
                  void fetchPreview({
                    data: { companyId: settings.companyId, billingAccountId: id },
                  }).then(setPreview);
                }}
                className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {preview.billingAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.accountName} · {account.accountNumber} ·{" "}
                    {florin(account.availableBalance)} available
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-4 text-[13px] text-muted-foreground">
              Your billing account will be charged {florin(preview.monthlyFee)} immediately. Pro
              features activate after a successful charge.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() => void confirmPurchase()}
                className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-medium text-background"
              >
                Confirm purchase
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setConfirmOpen(false)}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </Card>
        </div>
      ) : null}

      {message ? <p className="text-[13px] text-muted-foreground">{message}</p> : null}
      {error ? (
        <p className="text-[13px] text-destructive">
          {error.replace(/^BAD_REQUEST:/, "")}{" "}
          {!isPro ? (
            <Link
              to="/bank/account/$accountId/commercial/settings"
              params={{ accountId }}
              className="underline"
            >
              Review settings
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

function UsageRow({
  label,
  value,
  limit,
}: {
  label: string;
  value: number;
  limit: number | null;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">
        {value}
        {limit != null ? ` / ${limit}` : " · Unlimited"}
      </dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
