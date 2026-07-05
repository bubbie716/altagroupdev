"use client";

import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/page-shell";
import { RouteButton } from "@/components/bank/route-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CommercialProUpgradePanel } from "@/components/bank/commercial/commercial-pro-upgrade-panel";
import { CommercialProDowngradePanel } from "@/components/bank/commercial/commercial-pro-downgrade-panel";
import type { CommercialBillingAccountOption } from "@/lib/bank/commercial-billing-types";
import type { CommercialSettingsView } from "@/lib/bank/commercial-banking-types";
import { accountCommercialRoutes } from "@/lib/bank/account-commercial-path";
import {
  COMMERCIAL_PLAN_DESCRIPTIONS,
  COMMERCIAL_PLAN_LABELS,
} from "@/lib/bank/commercial-banking-types";
import { florin } from "@/lib/bank/api";
import { formatActivityDateTime } from "@/lib/format-datetime";
import {
  fetchCommercialBillingAccounts,
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
  const fetchAccounts = useServerFn(fetchCommercialBillingAccounts);
  const updateBillingAccount = useServerFn(updateCommercialBillingAccountFn);

  const [billingAccountId, setBillingAccountId] = useState(
    settings.billingAccountId ?? "",
  );
  const [billingAccounts, setBillingAccounts] = useState<CommercialBillingAccountOption[]>([]);
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
        setBillingAccountId((current) => {
          if (current && rows.some((row) => row.id === current)) return current;
          if (
            settings.billingAccountId &&
            rows.some((row) => row.id === settings.billingAccountId)
          ) {
            return settings.billingAccountId;
          }
          return rows[0]?.id ?? "";
        });
      })
      .catch(() => undefined);
  }, [
    settings.canManageBillingAccount,
    settings.companyId,
    settings.billingAccountId,
    fetchAccounts,
  ]);

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
              <CommercialProUpgradePanel companyId={settings.companyId} onCompleted={onUpdated}>
                {({ open, loading }) => (
                  <button
                    type="button"
                    disabled={loading || saving}
                    onClick={() => void open()}
                    className="mt-4 inline-flex rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-60"
                  >
                    Upgrade to Pro
                  </button>
                )}
              </CommercialProUpgradePanel>
            </div>
          ) : isPro && settings.canDowngradePro ? (
            <div className="rounded-lg border border-border p-5">
              <p className="font-medium">Downgrade to Core</p>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                Stop Pro billing and return to Core limits. Pending payroll and excess receivables
                created this month may be cancelled.
              </p>
              <CommercialProDowngradePanel companyId={settings.companyId} onCompleted={onUpdated}>
                {({ open, loading }) => (
                  <button
                    type="button"
                    disabled={loading || saving}
                    onClick={() => void open()}
                    className="mt-4 inline-flex rounded-md border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/5 disabled:opacity-60"
                  >
                    Downgrade to Core
                  </button>
                )}
              </CommercialProDowngradePanel>
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
            label="Payment links this month"
            value={usage.paymentLinksThisMonth}
            limit={usage.isPro ? null : usage.limits.corePaymentLinkMonthlyLimit}
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
              <label className="block min-w-[16rem] flex-1">
                <span className="text-xs text-muted-foreground">Billing account</span>
                <BillingAccountSelect
                  accounts={billingAccounts}
                  value={billingAccountId}
                  onValueChange={setBillingAccountId}
                  className="mt-1"
                />
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
          Invoice & payment link branding
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Customize customer-facing invoices, payment links, and receipts with your logo and colors.
          {isPro
            ? " Your branding is live on customer checkout pages."
            : " Available on Alta Commercial Pro."}
        </p>
        {isPro ? (
          <RouteButton
            to={accountCommercialRoutes.branding}
            params={{ accountId }}
            className="mt-4 inline-block rounded-md border border-border px-4 py-2 text-sm font-medium transition hover:bg-surface-2/60"
          >
            Manage branding
          </RouteButton>
        ) : null}
      </Card>

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

function formatBillingAccountLabel(account: CommercialBillingAccountOption): string {
  return `${account.accountName} · ${account.accountNumber} · ${florin(account.availableBalance)} available`;
}

function BillingAccountSelect({
  accounts,
  value,
  onValueChange,
  className,
}: {
  accounts: CommercialBillingAccountOption[];
  value: string;
  onValueChange: (id: string) => void;
  className?: string;
}) {
  const selectedValue =
    value && accounts.some((account) => account.id === value)
      ? value
      : (accounts[0]?.id ?? "");

  if (!selectedValue) return null;

  return (
    <Select value={selectedValue} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Select billing account" />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            {formatBillingAccountLabel(account)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
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
