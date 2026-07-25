"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SUBMITTING_COPY } from "@/lib/ui/route-loading";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown } from "lucide-react";
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
import {
  ALL_DISCORD_NOTIFICATION_TYPES,
  COLLAPSED_BY_DEFAULT_DISCORD_GROUP_IDS,
  DISCORD_NOTIFICATION_PRESETS,
  DISCORD_NOTIFICATION_PRESET_DESCRIPTIONS,
  DISCORD_NOTIFICATION_PRESET_LABELS,
  allDiscordNotificationsOff,
  anyDiscordNotificationEnabled,
  applyDiscordNotificationPreset,
  detectDiscordNotificationPreset,
  discordGroupEnabledCount,
  enabledDiscordNotificationCount,
  isDiscordNotificationEnabled,
  setDiscordGroupEnabled,
  type DiscordNotificationPreset,
} from "@/lib/bank/bank-settings-presets";
import type { PaymentEngineNotificationPrefs } from "@/lib/bank/payments-engine-types";
import { DEFAULT_PAYMENT_ENGINE_NOTIFICATION_PREFS } from "@/lib/bank/payments-engine-types";
import { updateUserBankSettingsRecord } from "@/lib/bank/bank-settings.functions";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";
import { cn } from "@/lib/utils";

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:border-gold/60 focus-visible:ring-0 focus-visible:shadow-none";

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

/**
 * Compares effective values rather than stored shapes, so rewriting an implicit
 * "on" as an explicit `true` never counts as an edit.
 */
function settingsAreDirty(current: SettingsBaseline, baseline: SettingsBaseline): boolean {
  if (
    current.receiveAccountId !== baseline.receiveAccountId ||
    current.fundingAccountId !== baseline.fundingAccountId
  ) {
    return true;
  }

  const discordDirty = ALL_DISCORD_NOTIFICATION_TYPES.some(
    (type) =>
      isDiscordNotificationEnabled(current.notificationPrefs, type) !==
      isDiscordNotificationEnabled(baseline.notificationPrefs, type),
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
  label,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
}) {
  return (
    <SwitchPrimitives.Root
      id={id}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      className="inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-0 bg-muted-foreground/25 p-0.5 shadow-none outline-none transition-[background-color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary"
    >
      <SwitchPrimitives.Thumb
        className="block size-4 shrink-0 rounded-full bg-white shadow-sm outline-none transition-transform duration-200 ease-out will-change-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
      />
    </SwitchPrimitives.Root>
  );
}

function SwitchRow({
  id,
  label,
  checked,
  disabled,
  onCheckedChange,
  first,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  first?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-h-11 items-center justify-between gap-4 px-4 py-2",
        !first && "border-t border-border/50",
      )}
    >
      <label htmlFor={id} className="cursor-pointer text-[14px] leading-snug select-none">
        {label}
      </label>
      <NotificationSwitch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

function Disclosure({
  title,
  summary,
  defaultOpen = false,
  actions,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-xl border border-border/60">
      <div className="flex items-center gap-2 bg-surface-2/40 pr-3">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-h-11 flex-1 items-center gap-2 px-4 py-2 text-left"
        >
          <ChevronDown
            aria-hidden
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
              !open && "-rotate-90",
            )}
          />
          <span className="text-[13px] font-medium text-foreground">{title}</span>
          {summary ? (
            <span className="text-[12px] tabular-nums text-muted-foreground">{summary}</span>
          ) : null}
        </button>
        {open ? actions : null}
      </div>
      {open ? <div className="border-t border-border/50">{children}</div> : null}
    </div>
  );
}

function GroupBulkAction({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="shrink-0 rounded-full px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function PresetOption({
  preset,
  active,
  disabled,
  onSelect,
}: {
  preset: DiscordNotificationPreset;
  active: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex-1 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {DISCORD_NOTIFICATION_PRESET_LABELS[preset]}
    </button>
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
          tabIndex={visible ? 0 : -1}
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
  /** Null means "derive the preset from saved prefs" — set once the customer picks one. */
  const [presetChoice, setPresetChoice] = useState<DiscordNotificationPreset | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  /** Remembers the category selection while the master switch is off. */
  const suspendedPrefs = useRef<DiscordNotificationPrefs | null>(null);
  const appliedSettings = useRef(initialSettings);

  // `router.invalidate()` after a save hands back a new object with identical
  // values; resetting on that would clear the save confirmation, so only rebuild
  // the form when the server values themselves changed.
  useEffect(() => {
    if (appliedSettings.current === initialSettings) return;
    appliedSettings.current = initialSettings;

    const nextBaseline = baselineFromSettings(initialSettings);
    if (!settingsAreDirty(nextBaseline, baseline)) {
      setBaseline(nextBaseline);
      return;
    }

    setBaseline(nextBaseline);
    setReceiveAccountId(receiveAccountSelectValue(initialSettings));
    setFundingAccountId(nextBaseline.fundingAccountId);
    setNotificationPrefs(nextBaseline.notificationPrefs);
    setEngineNotificationPrefs(nextBaseline.engineNotificationPrefs);
    setPresetChoice(null);
    suspendedPrefs.current = null;
    setSaved(false);
  }, [initialSettings, baseline]);

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

  const discordEnabled = useMemo(
    () => anyDiscordNotificationEnabled(notificationPrefs),
    [notificationPrefs],
  );
  const detectedPreset = useMemo(
    () => detectDiscordNotificationPreset(notificationPrefs),
    [notificationPrefs],
  );
  const activePreset = presetChoice ?? detectedPreset;
  const enabledCount = useMemo(
    () => enabledDiscordNotificationCount(notificationPrefs),
    [notificationPrefs],
  );

  function toggleDiscordMaster(checked: boolean) {
    if (!checked) {
      suspendedPrefs.current = notificationPrefs;
      setNotificationPrefs(allDiscordNotificationsOff());
      return;
    }

    const restored = suspendedPrefs.current;
    suspendedPrefs.current = null;
    if (restored && anyDiscordNotificationEnabled(restored)) {
      setNotificationPrefs(restored);
      setPresetChoice(null);
      return;
    }
    setNotificationPrefs(applyDiscordNotificationPreset("recommended"));
    setPresetChoice(null);
  }

  function selectPreset(preset: DiscordNotificationPreset) {
    if (preset === "custom") {
      setPresetChoice("custom");
      return;
    }
    setNotificationPrefs(applyDiscordNotificationPreset(preset));
    setPresetChoice(null);
  }

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
      setPresetChoice(null);
      setSaved(true);
      await router.invalidate();
    } catch (err) {
      setError(formatCustomerActionError(err, "settings"));
    } finally {
      setSaving(false);
    }
  }

  const categoriesDisabled = saving || !discordEnabled;

  return (
    <>
      <UnsavedChangesBanner
        visible={isDirty}
        saving={saving}
        onSave={() => void saveChanges()}
      />

      {/* Not a <form>: Radix Switch mirrors itself into a hidden checkbox inside
          forms, which would double every preference control in the a11y tree. */}
      <div className="space-y-6">
        <Card className="space-y-5 !p-6">
          <h2 className="type-section-title">Alta Pay</h2>

          <label className="block">
            <span className={fieldLabel}>Default receive account</span>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Where Alta Pay lands when someone pays you by name.
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
            ) : receiveAccountId === NONE_VALUE &&
              initialSettings.defaultAltaPayReceiveAccountId ? (
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
              Preselected when you send Alta Pay.
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

        <Card className="space-y-5 !p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="type-section-title">Discord notifications</h2>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                In-app notifications are always delivered.
              </p>
            </div>
            <NotificationSwitch
              id="discord-notifications-master"
              label="Discord notifications"
              checked={discordEnabled}
              disabled={saving}
              onCheckedChange={toggleDiscordMaster}
            />
          </div>

          {discordEnabled ? (
            <>
              <div>
                <div
                  role="radiogroup"
                  aria-label="Discord notification level"
                  className="flex gap-1 rounded-lg bg-surface-2/60 p-1"
                >
                  {DISCORD_NOTIFICATION_PRESETS.map((preset) => (
                    <PresetOption
                      key={preset}
                      preset={preset}
                      active={activePreset === preset}
                      disabled={saving}
                      onSelect={() => selectPreset(preset)}
                    />
                  ))}
                </div>
                <p className="mt-2 text-[12px] text-muted-foreground">
                  {DISCORD_NOTIFICATION_PRESET_DESCRIPTIONS[activePreset]}{" "}
                  <span className="tabular-nums">
                    {enabledCount} of {ALL_DISCORD_NOTIFICATION_TYPES.length} on.
                  </span>
                </p>
              </div>

              {activePreset === "custom" ? (
                <div className="space-y-2">
                  {BANK_DISCORD_NOTIFICATION_GROUPS.map((group) => {
                    const { enabled, total } = discordGroupEnabledCount(notificationPrefs, group.id);
                    return (
                      <Disclosure
                        key={group.id}
                        title={group.label}
                        summary={`${enabled}/${total}`}
                        defaultOpen={
                          !COLLAPSED_BY_DEFAULT_DISCORD_GROUP_IDS.includes(group.id) &&
                          enabled > 0
                        }
                        actions={
                          <>
                            <GroupBulkAction
                              disabled={categoriesDisabled || enabled === total}
                              onClick={() =>
                                setNotificationPrefs((current) =>
                                  setDiscordGroupEnabled(current, group.id, true),
                                )
                              }
                            >
                              Select all
                            </GroupBulkAction>
                            <GroupBulkAction
                              disabled={categoriesDisabled || enabled === 0}
                              onClick={() =>
                                setNotificationPrefs((current) =>
                                  setDiscordGroupEnabled(current, group.id, false),
                                )
                              }
                            >
                              Clear
                            </GroupBulkAction>
                          </>
                        }
                      >
                        {group.options.map((option, index) => (
                          <SwitchRow
                            key={option.type}
                            id={`discord-notification-${option.type}`}
                            label={option.label}
                            first={index === 0}
                            checked={isDiscordNotificationEnabled(notificationPrefs, option.type)}
                            disabled={categoriesDisabled}
                            onCheckedChange={(checked) => {
                              setNotificationPrefs((current) => ({
                                ...current,
                                [option.type]: checked,
                              }));
                              setPresetChoice("custom");
                            }}
                          />
                        ))}
                      </Disclosure>
                    );
                  })}
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              The Discord bot won&apos;t send you Alta Bank alerts.
            </p>
          )}
        </Card>

        <Card className="space-y-5 !p-6">
          <div>
            <h2 className="type-section-title">Payment engine alerts</h2>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              Alta Pay schedules, recurring payments, and merchant AutoPay.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-border/60 bg-surface-2/40">
            {PAYMENT_ENGINE_NOTIFICATION_OPTIONS.map((option, index) => (
              <SwitchRow
                key={option.key}
                id={`payment-engine-notification-${option.key}`}
                label={option.label}
                first={index === 0}
                checked={
                  (engineNotificationPrefs[option.key] ??
                    DEFAULT_PAYMENT_ENGINE_NOTIFICATION_PREFS[option.key]) !== false
                }
                disabled={saving}
                onCheckedChange={(checked) =>
                  setEngineNotificationPrefs((current) => ({
                    ...current,
                    [option.key]: checked,
                  }))
                }
              />
            ))}
          </div>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={saving || !isDirty}
            onClick={() => void saveChanges()}
            className="min-h-11 rounded-md bg-foreground px-5 py-2.5 text-[13px] font-medium text-background disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? SUBMITTING_COPY.saving : "Save settings"}
          </button>
          {saved && !isDirty ? (
            <p
              role="status"
              aria-live="polite"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground"
            >
              <Check className="size-3.5" aria-hidden />
              Saved
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
