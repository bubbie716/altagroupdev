"use client";

import { useEffect, useMemo, useState } from "react";
import { SUBMITTING_COPY } from "@/lib/ui/route-loading";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/page-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BANK_DISCORD_NOTIFICATION_GROUPS,
  PAYMENT_ENGINE_NOTIFICATION_OPTIONS,
  type DiscordNotificationPrefs,
  type UserBankSettingsView,
} from "@/lib/bank/bank-settings-types";
import type { PaymentEngineNotificationPrefs } from "@/lib/bank/payments-engine-types";
import { DEFAULT_PAYMENT_ENGINE_NOTIFICATION_PREFS } from "@/lib/bank/payments-engine-types";
import { updateUserBankSettingsRecord } from "@/lib/bank/bank-settings.functions";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";
import { cn } from "@/lib/utils";

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40";

const NONE_VALUE = "__none__";

type SettingsBaseline = {
  receiveAccountId: string;
  fundingAccountId: string;
  notificationPrefs: DiscordNotificationPrefs;
  engineNotificationPrefs: PaymentEngineNotificationPrefs;
};

function baselineFromSettings(settings: UserBankSettingsView): SettingsBaseline {
  return {
    receiveAccountId:
      settings.explicitDefaultAltaPayReceiveAccountId ?? NONE_VALUE,
    fundingAccountId: settings.defaultAltaPayFundingAccountId ?? NONE_VALUE,
    notificationPrefs: settings.discordNotificationPrefs,
    engineNotificationPrefs: settings.paymentEngineNotificationPrefs,
  };
}

function receiveAccountSelectValue(settings: UserBankSettingsView): string {
  return settings.explicitDefaultAltaPayReceiveAccountId ?? NONE_VALUE;
}

function settingsAreDirty(current: SettingsBaseline, baseline: SettingsBaseline): boolean {
  if (
    current.receiveAccountId !== baseline.receiveAccountId ||
    current.fundingAccountId !== baseline.fundingAccountId
  ) {
    return true;
  }

  const discordDirty = BANK_DISCORD_NOTIFICATION_GROUPS.some((group) =>
    group.options.some((option) => {
      const currentEnabled = current.notificationPrefs[option.type] !== false;
      const baselineEnabled = baseline.notificationPrefs[option.type] !== false;
      return currentEnabled !== baselineEnabled;
    }),
  );
  if (discordDirty) return true;

  return PAYMENT_ENGINE_NOTIFICATION_OPTIONS.some((option) => {
    const currentEnabled =
      (current.engineNotificationPrefs[option.key] ??
        DEFAULT_PAYMENT_ENGINE_NOTIFICATION_PREFS[option.key]) !== false;
    const baselineEnabled =
      (baseline.engineNotificationPrefs[option.key] ??
        DEFAULT_PAYMENT_ENGINE_NOTIFICATION_PREFS[option.key]) !== false;
    return currentEnabled !== baselineEnabled;
  });
}

function accountOptionLabel(account: {
  accountName: string;
  accountNumber: string;
  ownerLabel: string | null;
}) {
  const owner = account.ownerLabel ? ` · ${account.ownerLabel}` : "";
  return `${account.accountName} · ${account.accountNumber}${owner}`;
}

function NotificationSwitch({
  id,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <SwitchPrimitives.Root
      id={id}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      className="inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-0 bg-muted-foreground/25 p-0.5 shadow-none outline-none transition-[background-color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary"
    >
      <SwitchPrimitives.Thumb
        className="block size-4 shrink-0 rounded-full bg-white shadow-sm outline-none transition-transform duration-200 ease-out will-change-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
      />
    </SwitchPrimitives.Root>
  );
}

function UnsavedChangesBanner({
  visible,
  saving,
  onSave,
}: {
  visible: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-14 z-40 flex justify-center px-4 pt-2 sm:top-16">
      <div
        role="status"
        aria-live="polite"
        aria-hidden={!visible}
        className={cn(
          "pointer-events-auto flex items-center gap-3 rounded-full border border-red-900/25 bg-destructive px-4 py-2 text-destructive-foreground shadow-lg transition-all duration-300 ease-out",
          visible
            ? "translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-6 scale-95 opacity-0",
        )}
      >
        <p className="whitespace-nowrap text-[12px] font-medium">Unsaved changes</p>
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="shrink-0 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-medium transition-colors hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? SUBMITTING_COPY.saving : "Save"}
        </button>
      </div>
    </div>
  );
}

export function BankSettingsForm({ initialSettings }: { initialSettings: UserBankSettingsView }) {
  const router = useRouter();
  const saveSettings = useServerFn(updateUserBankSettingsRecord);

  const [baseline, setBaseline] = useState(() => baselineFromSettings(initialSettings));
  const [receiveAccountId, setReceiveAccountId] = useState(() =>
    receiveAccountSelectValue(initialSettings),
  );
  const [fundingAccountId, setFundingAccountId] = useState(baseline.fundingAccountId);
  const [notificationPrefs, setNotificationPrefs] = useState(baseline.notificationPrefs);
  const [engineNotificationPrefs, setEngineNotificationPrefs] = useState(
    baseline.engineNotificationPrefs,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const nextBaseline = baselineFromSettings(initialSettings);
    setBaseline(nextBaseline);
    setReceiveAccountId(receiveAccountSelectValue(initialSettings));
    setFundingAccountId(nextBaseline.fundingAccountId);
    setNotificationPrefs(nextBaseline.notificationPrefs);
    setEngineNotificationPrefs(nextBaseline.engineNotificationPrefs);
    setSaved(false);
  }, [initialSettings]);

  const isDirty = useMemo(
    () =>
      settingsAreDirty(
        { receiveAccountId, fundingAccountId, notificationPrefs, engineNotificationPrefs },
        baseline,
      ),
    [receiveAccountId, fundingAccountId, notificationPrefs, engineNotificationPrefs, baseline],
  );

  useEffect(() => {
    if (isDirty) setSaved(false);
  }, [isDirty]);

  async function saveChanges() {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const updated = await saveSettings({
        data: {
          defaultAltaPayReceiveAccountId:
            receiveAccountId === NONE_VALUE ? null : receiveAccountId,
          defaultAltaPayFundingAccountId:
            fundingAccountId === NONE_VALUE ? null : fundingAccountId,
          discordNotificationPrefs: notificationPrefs,
          paymentEngineNotificationPrefs: engineNotificationPrefs,
        },
      });

      const nextBaseline = baselineFromSettings(updated);
      setBaseline(nextBaseline);
      setReceiveAccountId(receiveAccountSelectValue(updated));
      setFundingAccountId(nextBaseline.fundingAccountId);
      setNotificationPrefs(nextBaseline.notificationPrefs);
    setEngineNotificationPrefs(nextBaseline.engineNotificationPrefs);
      setSaved(true);
      await router.invalidate();
    } catch (err) {
      setError(formatCustomerActionError(err, "settings"));
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await saveChanges();
  }

  return (
    <>
      <UnsavedChangesBanner
        visible={isDirty}
        saving={saving}
        onSave={() => void saveChanges()}
      />

      <form onSubmit={handleSubmit} className="space-y-10">
      <Card className="space-y-6 !p-6">
        <div>
          <h2 className="type-section-title">Alta Pay</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Choose where you receive Alta Pay and which account you prefer to pay from.
          </p>
        </div>

        <label className="block">
          <span className={fieldLabel}>Default receive account</span>
          <p className="mt-1 text-[12px] text-muted-foreground">
            When someone pays you by name in Alta Pay, funds settle to this account. If you
            haven&apos;t chosen one, your oldest personal account is used automatically.
          </p>
          <Select value={receiveAccountId} onValueChange={setReceiveAccountId} disabled={saving}>
            <SelectTrigger className={`${inputClass} h-auto min-h-10`}>
              <SelectValue placeholder="Select an account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>Automatic · oldest account</SelectItem>
              {initialSettings.receiveAccountOptions.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {accountOptionLabel(account)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {initialSettings.receiveAccountOptions.length === 0 ? (
            <p className="mt-2 text-[12px] text-muted-foreground">
              Open a personal Alta Bank account to receive Alta Pay.
            </p>
          ) : receiveAccountId === NONE_VALUE && initialSettings.defaultAltaPayReceiveAccountId ? (
            <p className="mt-2 text-[12px] text-muted-foreground">
              Currently{" "}
              {initialSettings.receiveAccountOptions.find(
                (account) => account.id === initialSettings.defaultAltaPayReceiveAccountId,
              )?.accountName ?? "your oldest account"}
              .
            </p>
          ) : null}
        </label>

        <label className="block">
          <span className={fieldLabel}>Default funding account</span>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Preselects the account you pay from on the Alta Pay page.
          </p>
          <Select value={fundingAccountId} onValueChange={setFundingAccountId} disabled={saving}>
            <SelectTrigger className={`${inputClass} h-auto min-h-10`}>
              <SelectValue placeholder="Select an account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>No default</SelectItem>
              {initialSettings.fundingAccountOptions.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {accountOptionLabel(account)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </Card>

      <Card className="space-y-6 !p-6">
        <div>
          <h2 className="type-section-title">Discord notifications</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Choose which Alta Bank alerts the Discord bot sends you. In-app notifications are always
            delivered.
          </p>
        </div>

        <div className="space-y-6">
          {BANK_DISCORD_NOTIFICATION_GROUPS.map((group) => (
            <div key={group.id}>
              <h3 className="text-[13px] font-medium text-foreground">{group.label}</h3>
              <div className="mt-3 overflow-hidden rounded-xl bg-surface-2/50">
                {group.options.map((option, index) => {
                  const enabled = notificationPrefs[option.type] !== false;
                  const switchId = `discord-notification-${option.type}`;
                  return (
                    <div
                      key={option.type}
                      className={cn(
                        "flex min-h-11 items-center justify-between gap-4 px-4 py-2",
                        index > 0 && "border-t border-border/50",
                      )}
                    >
                      <label
                        htmlFor={switchId}
                        className="cursor-pointer text-[15px] leading-snug select-none"
                      >
                        {option.label}
                      </label>
                      <NotificationSwitch
                        id={switchId}
                        checked={enabled}
                        disabled={saving}
                        onCheckedChange={(checked) =>
                          setNotificationPrefs((current) => ({
                            ...current,
                            [option.type]: checked,
                          }))
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="space-y-6 !p-6">
        <div>
          <h2 className="type-section-title">Payment engine alerts</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Alta Pay schedules, recurring payments, and merchant AutoPay notifications.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl bg-surface-2/50">
          {PAYMENT_ENGINE_NOTIFICATION_OPTIONS.map((option, index) => {
            const enabled =
              (engineNotificationPrefs[option.key] ??
                DEFAULT_PAYMENT_ENGINE_NOTIFICATION_PREFS[option.key]) !== false;
            const switchId = `payment-engine-notification-${option.key}`;
            return (
              <div
                key={option.key}
                className={cn(
                  "flex min-h-11 items-center justify-between gap-4 px-4 py-2",
                  index > 0 && "border-t border-border/50",
                )}
              >
                <label
                  htmlFor={switchId}
                  className="cursor-pointer text-[15px] leading-snug select-none"
                >
                  {option.label}
                </label>
                <NotificationSwitch
                  id={switchId}
                  checked={enabled}
                  disabled={saving}
                  onCheckedChange={(checked) =>
                    setEngineNotificationPrefs((current) => ({
                      ...current,
                      [option.key]: checked,
                    }))
                  }
                />
              </div>
            );
          })}
        </div>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && (
        <p className="text-sm text-muted-foreground">Settings saved.</p>
      )}

      <button
        type="submit"
        disabled={saving || !isDirty}
        className="rounded-md bg-foreground px-5 py-2.5 text-[13px] font-medium text-background disabled:opacity-50"
      >
        {saving ? SUBMITTING_COPY.saving : "Save settings"}
      </button>
    </form>
    </>
  );
}
