"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SUBMITTING_COPY } from "@/lib/ui/route-loading";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/page-shell";
import { CommercialProUpgradePanel } from "@/components/bank/commercial/commercial-pro-upgrade-panel";
import {
  CommercialBrandedCheckoutShell,
  CommercialBrandedReceiptShell,
} from "@/components/bank/commercial/commercial-branded-checkout-shell";
import type { CompanyBrandingSettingsView } from "@/lib/bank/company-branding-types";
import { updateCompanyBrandingSettingsRecord } from "@/lib/bank/company-branding.functions";
import { florin } from "@/lib/bank/api";
import { resolvePreviewBranding } from "@/lib/bank/company-branding-resolve";

const fieldLabel = "type-meta";
const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-60";

type BrandingFormState = {
  brandColor: string;
  accentColor: string;
  invoiceFooterText: string;
  paymentLinkFooterText: string;
  supportEmail: string;
  supportDiscord: string;
  websiteUrl: string;
  displayNameOverride: string;
};

function toFormState(settings: CompanyBrandingSettingsView): BrandingFormState {
  return {
    brandColor: settings.brandColor,
    accentColor: settings.accentColor,
    invoiceFooterText: settings.invoiceFooterText ?? "",
    paymentLinkFooterText: settings.paymentLinkFooterText ?? "",
    supportEmail: settings.supportEmail ?? "",
    supportDiscord: settings.supportDiscord ?? "",
    websiteUrl: settings.websiteUrl ?? "",
    displayNameOverride: settings.displayNameOverride ?? "",
  };
}

export function CommercialBrandingPanel({
  settings,
  accountId,
  onUpdated,
}: {
  settings: CompanyBrandingSettingsView;
  accountId: string;
  onUpdated: () => void;
}) {
  const updateBranding = useServerFn(updateCompanyBrandingSettingsRecord);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<BrandingFormState>(() => toFormState(settings));
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl);
  const [localLogoObjectUrl, setLocalLogoObjectUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setForm(toFormState(settings));
    setLogoUrl(settings.logoUrl);
    setLocalLogoObjectUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }, [settings]);

  useEffect(() => {
    return () => {
      if (localLogoObjectUrl) URL.revokeObjectURL(localLogoObjectUrl);
    };
  }, [localLogoObjectUrl]);

  const previewBrandingState = useMemo(
    () =>
      resolvePreviewBranding({
        companyName: settings.companyName,
        branding: settings,
        draft: {
          brandColor: form.brandColor,
          accentColor: form.accentColor,
          logoUrl,
          invoiceFooterText: form.invoiceFooterText || null,
          paymentLinkFooterText: form.paymentLinkFooterText || null,
          supportEmail: form.supportEmail || null,
          supportDiscord: form.supportDiscord || null,
          websiteUrl: form.websiteUrl || null,
          displayNameOverride: form.displayNameOverride || null,
        },
      }),
    [form, logoUrl, settings],
  );

  const previewInvoiceFooter = useMemo(
    () => form.invoiceFooterText.trim() || null,
    [form.invoiceFooterText],
  );
  const previewLinkFooter = useMemo(
    () => form.paymentLinkFooterText.trim() || null,
    [form.paymentLinkFooterText],
  );

  async function saveBranding() {
    if (!settings.canPublish) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateBranding({
        data: {
          companyId: settings.companyId,
          branding: {
            brandColor: form.brandColor,
            accentColor: form.accentColor,
            invoiceFooterText: form.invoiceFooterText || null,
            paymentLinkFooterText: form.paymentLinkFooterText || null,
            supportEmail: form.supportEmail || null,
            supportDiscord: form.supportDiscord || null,
            websiteUrl: form.websiteUrl || null,
            displayNameOverride: form.displayNameOverride || null,
          },
        },
      });
      setMessage("Branding saved. Customer invoices and payment links will use your custom styling.");
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Could not save branding.");
    } finally {
      setSaving(false);
    }
  }

  function setLocalLogoPreview(file: File) {
    setLocalLogoObjectUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      const url = URL.createObjectURL(file);
      setLogoUrl(url);
      return url;
    });
  }

  async function onLogoSelected(file: File | null) {
    if (!file) return;
    setError(null);

    if (!settings.canPublish) {
      setLocalLogoPreview(file);
      setMessage("Logo added to preview. Upgrade to Pro to publish it on customer pages.");
      return;
    }

    setUploading(true);
    setMessage(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`/api/company-branding/${settings.companyId}/logo`, {
        method: "POST",
        body,
      });
      const payload = (await res.json().catch(() => null)) as { logoUrl?: string; error?: string };
      if (!res.ok) {
        throw new Error(payload?.error ?? "Logo upload failed.");
      }
      setLocalLogoObjectUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return null;
      });
      setLogoUrl(payload.logoUrl ?? null);
      setMessage("Logo uploaded.");
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logo upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      {!settings.canPublish ? (
        <Card className="!p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
            Alta Commercial Pro
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            Customize invoice and payment link branding with your logo, colors, and footer text.
            Preview your design below — publishing custom branding requires Alta Commercial Pro.
          </p>
          <div className="mt-4">
            <CommercialProUpgradePanel companyId={settings.companyId} onCompleted={onUpdated}>
              {({ open, loading }) => (
                <button
                  type="button"
                  disabled={loading}
                  onClick={open}
                  className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
                >
                  Upgrade to Pro
                </button>
              )}
            </CommercialProUpgradePanel>
          </div>
        </Card>
      ) : null}

      {settings.rejectedAt ? (
        <Card className="border-destructive/40 !p-4 text-sm text-destructive">
          Custom branding was rejected by Alta staff
          {settings.rejectedReason ? `: ${settings.rejectedReason}` : "."} Public pages use default
          Alta styling until you update and resave.
        </Card>
      ) : null}

      <Card className="!p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">Brand assets</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="block">
            <span className={fieldLabel}>Logo</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={uploading}
              onChange={(e) => {
                void onLogoSelected(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
              className="sr-only"
            />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium transition hover:bg-surface-2/60 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploading ? SUBMITTING_COPY.uploading : logoUrl ? "Change logo" : "Choose file"}
              </button>
              <span className="text-[13px] text-muted-foreground">PNG, JPEG, or WebP</span>
            </div>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Company logo preview"
                className="mt-3 h-16 w-16 rounded-lg border border-border object-contain p-1"
              />
            ) : null}
          </div>
          <label className="block">
            <span className={fieldLabel}>Display name override</span>
            <input
              className={inputClass}
              value={form.displayNameOverride}
              onChange={(e) => setForm((prev) => ({ ...prev, displayNameOverride: e.target.value }))}
              placeholder={settings.companyName}
            />
          </label>
          <label className="block">
            <span className={fieldLabel}>Brand color</span>
            <input
              className={inputClass}
              value={form.brandColor}
              onChange={(e) => setForm((prev) => ({ ...prev, brandColor: e.target.value }))}
              placeholder="#0f1729"
            />
          </label>
          <label className="block">
            <span className={fieldLabel}>Accent color</span>
            <input
              className={inputClass}
              value={form.accentColor}
              onChange={(e) => setForm((prev) => ({ ...prev, accentColor: e.target.value }))}
              placeholder="#c9a227"
            />
          </label>
        </div>
      </Card>

      <Card className="!p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">Footer & support</p>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className={fieldLabel}>Invoice footer</span>
            <textarea
              className={`${inputClass} min-h-[80px]`}
              value={form.invoiceFooterText}
              onChange={(e) => setForm((prev) => ({ ...prev, invoiceFooterText: e.target.value }))}
              maxLength={500}
            />
          </label>
          <label className="block">
            <span className={fieldLabel}>Payment link footer</span>
            <textarea
              className={`${inputClass} min-h-[80px]`}
              value={form.paymentLinkFooterText}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, paymentLinkFooterText: e.target.value }))
              }
              maxLength={500}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className={fieldLabel}>Support email</span>
              <input
                className={inputClass}
                value={form.supportEmail}
                onChange={(e) => setForm((prev) => ({ ...prev, supportEmail: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className={fieldLabel}>Support Discord</span>
              <input
                className={inputClass}
                value={form.supportDiscord}
                onChange={(e) => setForm((prev) => ({ ...prev, supportDiscord: e.target.value }))}
                placeholder="username"
              />
            </label>
            <label className="block">
              <span className={fieldLabel}>Website</span>
              <input
                className={inputClass}
                value={form.websiteUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, websiteUrl: e.target.value }))}
                placeholder="https://example.com"
              />
            </label>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={saving || !settings.canPublish}
            onClick={() => void saveBranding()}
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
          >
            {saving ? SUBMITTING_COPY.saving : settings.canPublish ? "Save branding" : "Pro required to publish"}
          </button>
        </div>
        {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <BrandingPreviewCard title="Invoice preview">
          <CommercialBrandedCheckoutShell
            branding={previewBrandingState}
            merchantName={settings.companyName}
            footerText={previewInvoiceFooter}
          >
            <Card className="space-y-4 !p-5">
              <p className="font-mono text-[11px] text-muted-foreground">INV-20260705-001</p>
              <p className="text-2xl font-semibold tabular-nums">{florin(1250)}</p>
              <p className="text-sm text-muted-foreground">Due Jul 15, 2026 · Consulting services</p>
            </Card>
          </CommercialBrandedCheckoutShell>
        </BrandingPreviewCard>

        <BrandingPreviewCard title="Payment link preview">
          <CommercialBrandedCheckoutShell
            branding={previewBrandingState}
            merchantName={settings.companyName}
            footerText={previewLinkFooter}
          >
            <Card className="space-y-4 !p-5">
              <p className="text-sm text-muted-foreground">Event registration deposit</p>
              <p className="text-2xl font-semibold tabular-nums">{florin(250)}</p>
            </Card>
          </CommercialBrandedCheckoutShell>
        </BrandingPreviewCard>

        <BrandingPreviewCard title="Receipt preview" className="xl:col-span-2">
          <CommercialBrandedReceiptShell
            branding={previewBrandingState}
            merchantName={settings.companyName}
            footerText={previewInvoiceFooter}
          >
            <Card className="!p-5 text-sm">
              <p className="font-mono text-[11px] text-muted-foreground">PAY-20260705-001</p>
              <p className="mt-2 text-lg font-semibold tabular-nums">{florin(1250)}</p>
              <p className="mt-1 text-muted-foreground">Paid from Personal Checking · ****4821</p>
            </Card>
          </CommercialBrandedReceiptShell>
        </BrandingPreviewCard>
      </div>
    </div>
  );
}

function BrandingPreviewCard({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`!p-4 ${className ?? ""}`}>
      <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </p>
      <div className="pointer-events-none scale-[0.98] origin-top">{children}</div>
    </Card>
  );
}
