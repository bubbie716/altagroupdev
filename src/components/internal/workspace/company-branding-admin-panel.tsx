"use client";

import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/page-shell";
import {
  resetCompanyBrandingAdminRecord,
  rejectCompanyBrandingAdminRecord,
  fetchCompanyBrandingAdminView,
} from "@/lib/bank/company-branding.functions";

export function CompanyBrandingAdminPanel({ companyId }: { companyId: string }) {
  const loadBranding = useServerFn(fetchCompanyBrandingAdminView);
  const resetBranding = useServerFn(resetCompanyBrandingAdminRecord);
  const rejectBranding = useServerFn(rejectCompanyBrandingAdminRecord);

  const [view, setView] = useState<Awaited<ReturnType<typeof loadBranding>> | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setView(await loadBranding({ data: companyId }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load branding.");
    } finally {
      setLoading(false);
    }
  }

  async function reset() {
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await resetBranding({ data: { companyId, reason: reason.trim() } });
      setMessage("Company branding reset.");
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Reset failed.");
    } finally {
      setLoading(false);
    }
  }

  async function reject() {
    if (!reason.trim()) {
      setError("A reason is required.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await rejectBranding({ data: { companyId, reason: reason.trim() } });
      setMessage("Company branding rejected.");
      setReason("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Reject failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="!p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Commercial branding
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            View, reset, or reject suspicious invoice/payment link branding.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium"
        >
          {loading ? "Loading…" : view ? "Refresh" : "Load branding"}
        </button>
      </div>

      {view ? (
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Plan</dt>
            <dd>{view.plan.commercialPlan}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Public custom branding</dt>
            <dd>{view.publicBranding.isCustomBrandingApplied ? "Active" : "Default Alta"}</dd>
          </div>
          {view.branding?.logoUrl ? (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Logo</dt>
              <dd>
                <img
                  src={view.branding.logoUrl}
                  alt=""
                  className="mt-1 h-12 w-12 rounded border object-contain"
                />
              </dd>
            </div>
          ) : null}
          {view.branding?.invoiceFooterText ? (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Invoice footer</dt>
              <dd>{view.branding.invoiceFooterText}</dd>
            </div>
          ) : null}
          {view.branding?.rejectedAt ? (
            <div className="sm:col-span-2 text-destructive">
              Rejected {new Date(view.branding.rejectedAt).toLocaleString()}
              {view.branding.rejectedReason ? `: ${view.branding.rejectedReason}` : ""}
            </div>
          ) : null}
        </dl>
      ) : null}

      <div className="mt-4 space-y-3">
        <label className="block text-sm">
          <span className="text-muted-foreground">Admin reason</span>
          <input
            className="mt-1 w-full rounded-md border border-border px-3 py-2 text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Required for reset or reject"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading || !view?.branding}
            onClick={() => void reset()}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium"
          >
            Reset branding
          </button>
          <button
            type="button"
            disabled={loading || !view?.branding || Boolean(view.branding.rejectedAt)}
            onClick={() => void reject()}
            className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive"
          >
            Reject branding
          </button>
        </div>
      </div>

      {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
    </Card>
  );
}
