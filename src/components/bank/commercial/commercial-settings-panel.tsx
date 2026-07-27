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
import { CommercialSubscriptionBillingHistoryPanel } from "@/components/bank/commercial/commercial-subscription-billing-history-panel";
import type { CommercialBillingAccountOption } from "@/lib/bank/commercial-billing-types";
import type { CommercialSettingsView } from "@/lib/bank/commercial-banking-types";
import { accountCommercialRoutes } from "@/lib/bank/account-commercial-path";
import {
  COMMERCIAL_BILLING_STATUS_LABELS,
  COMMERCIAL_FEATURE_LABELS,
  COMMERCIAL_PLAN_DESCRIPTIONS,
  COMMERCIAL_PLAN_LABELS,
  DEFAULT_COMMERCIAL_PRO_MONTHLY_FEE,
  type CommercialFeatureKey,
} from "@/lib/bank/commercial-banking-types";
import { florin } from "@/lib/bank/api";
import { formatActivityDateTime } from "@/lib/format-datetime";
import {
  fetchCommercialBillingAccounts,
  updateCommercialBillingAccountFn,
} from "@/lib/bank/commercial-banking.functions";

const CORE_COMPARISON = [
  "10 invoices / month",
  "5 payment links / month",
  "3 team members",
] as const;

const PRO_COMPARISON = [
  "Unlimited invoices & payment links",
  "Unlimited team members",
  "Payroll",
  "Advanced analytics",
  "Custom branding",
  "Priority support",
] as const;

function isCommercialFeatureKey(value: string): value is CommercialFeatureKey {
  return value in COMMERCIAL_FEATURE_LABELS;
}

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
  const proMonthlyFee = settings.monthlyFee ?? DEFAULT_COMMERCIAL_PRO_MONTHLY_FEE;
  const enabledFeatures = settings.enabledFeatures.filter(isCommercialFeatureKey);

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

        {settings.downgradeScheduledAt ? (
          <p className="mt-4 rounded-md border border-border/70 bg-surface-2/40 px-3 py-2 text-[13px] leading-relaxed text-muted-foreground">
            Downgrade to Core is scheduled for{" "}
            <span className="font-medium text-foreground">
              {formatActivityDateTime(settings.downgradeScheduledAt)}
            </span>
            . Pro features stay available until then.
          </p>
        ) : null}

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
            <ul className="mt-4 space-y-1.5 text-[13px] text-muted-foreground">
              {(isPro ? PRO_COMPARISON : CORE_COMPARISON).map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden="true">·</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            {settings.billingStatus === "PAST_DUE" ? (
              <p className="mt-3 text-[13px] text-destructive">
                Billing is past due. Add funds to your billing account to avoid downgrade.
              </p>
            ) : null}
          </div>
          {!isPro && settings.canPurchasePro ? (
            <div className="min-w-0 rounded-lg border border-border p-5">
              <p className="font-medium">Upgrade to Pro</p>
              <p className="mt-1 type-finance-nums text-[15px] font-medium tracking-tight">
                {florin(proMonthlyFee)}
                <span className="text-[13px] font-normal text-muted-foreground">/month</span>
              </p>
              <ul className="mt-3 space-y-1.5 text-[13px] leading-relaxed text-muted-foreground">
                {PRO_COMPARISON.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden="true">·</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
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
            <div className="min-w-0 rounded-lg border border-border p-5">
              <p className="font-medium">Downgrade to Core</p>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                Schedule Core for period end by default. Immediate downgrade requires confirming
                payroll and excess receivable cleanup.
              </p>
              <ul className="mt-3 space-y-1.5 text-[13px] text-muted-foreground">
                {CORE_COMPARISON.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden="true">·</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <CommercialProDowngradePanel companyId={settings.companyId} onCompleted={onUpdated}>
                {({ open, loading }) => (
                  <button
                    type="button"
                    disabled={loading || saving || Boolean(settings.downgradeScheduledAt)}
                    onClick={() => void open()}
                    className="mt-4 inline-flex rounded-md border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/5 disabled:opacity-60"
                  >
                    {settings.downgradeScheduledAt ? "Downgrade scheduled" : "Downgrade to Core"}
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
              <dd className="mt-1 text-sm font-medium">
                {COMMERCIAL_BILLING_STATUS_LABELS[settings.billingStatus]}
              </dd>
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
            {settings.downgradeScheduledAt ? (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground">Scheduled downgrade</dt>
                <dd className="mt-1 text-sm font-medium">
                  {formatActivityDateTime(settings.downgradeScheduledAt)}
                </dd>
              </div>
            ) : null}
          </dl>
          {settings.canManageBillingAccount && billingAccounts.length > 0 ? (
            <div className="mt-6 flex flex-wrap items-end gap-3">
              <label className="block min-w-0 w-full flex-1 sm:min-w-[16rem]">
                <span className="text-xs text-muted-foreground">Billing account</span>
                <BillingAccountSelect
                  accounts={billingAccounts}
                  value={billingAccountId}
                  onValueChange={setBillingAccountId}
                  className="mt-1 min-w-0"
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

      {(settings.canManagePlan || settings.canManageBillingAccount) && (
        <CommercialSubscriptionBillingHistoryPanel
          companyId={settings.companyId}
          canView={settings.canManagePlan || settings.canManageBillingAccount}
          isPro={isPro}
          nextBillingAtHint={settings.nextBillingAt}
        />
      )}

      <Card className="!p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
          Invoice & payment link branding
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Customize customer-facing invoices, payment links, and receipts with your logo and colors.
          {isPro
            ? " Your published branding is live on customer checkout pages."
            : " Core can preview designs; publishing requires Alta Commercial Pro. Until then, checkout uses Alta branding."}
        </p>
        <RouteButton
          to={accountCommercialRoutes.branding}
          params={{ accountId }}
          className="mt-4 inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium transition hover:bg-surface-2/60"
        >
          {isPro ? "Manage branding" : "Preview branding"}
        </RouteButton>
      </Card>

      <Card className="!p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
          Enabled features
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {enabledFeatures.map((feature) => (
            <li key={feature} className="flex items-center justify-between gap-3">
              <span>{COMMERCIAL_FEATURE_LABELS[feature]}</span>
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
      <SelectContent className="max-w-[min(100vw-2rem,24rem)]">
        {accounts.map((account) => (
          <SelectItem key={account.id} value={account.id} className="min-w-0">
            <span className="block min-w-0 truncate">{formatBillingAccountLabel(account)}</span>
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
