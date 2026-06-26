import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download, Printer, ZoomIn, ZoomOut } from "lucide-react";
import { BankReviewButton } from "@/components/bank/bank-review-button";
import {
  generateDealRoomAgreementDraft,
  prepareNewDealRoomAgreementDraft,
  saveDealRoomAgreementWorkspace,
  signDealRoomAgreementBank,
  signDealRoomAgreementBorrower,
  voidDealRoomAgreementDraft,
} from "@/lib/bank/deal-room.functions";
import type {
  AgreementFieldData,
  AgreementFieldKey,
  AgreementWorkspaceContext,
} from "@/lib/agreements/agreement-types";
import { cn } from "@/lib/utils";

const labelClass = "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground";
const fieldClass =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px] disabled:cursor-not-allowed disabled:opacity-60";

const FIELD_SECTIONS: { title: string; keys: AgreementFieldKey[] }[] = [
  {
    title: "Parties & reference",
    keys: ["borrowerName", "companyName", "loanId", "loanDate"],
  },
  {
    title: "Loan terms schedule",
    keys: [
      "principalAmount",
      "interestRateLine",
      "interestType",
      "compoundingPeriod",
      "interestRateVariability",
      "loanDurationLine",
      "maturityDate",
      "repaymentTerms",
      "firstPaymentDate",
    ],
  },
  {
    title: "Collateral & conditions",
    keys: [
      "collateral",
      "latePaymentInterest",
      "useRestrictions",
      "bondId",
      "additionalTerms",
    ],
  },
  {
    title: "Officer & witness",
    keys: ["lenderOfficerName", "lenderOfficerTitle", "witnessName"],
  },
  {
    title: "Internal only",
    keys: ["officerNotes", "internalNotes"],
  },
];

function CheckIcon({ complete }: { complete: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border text-[10px]",
        complete ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600" : "border-border text-muted-foreground",
      )}
      aria-hidden
    >
      {complete ? "✓" : ""}
    </span>
  );
}

function SignAgreementDialog({
  open,
  onClose,
  onConfirm,
  party,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (signatureName: string) => Promise<void>;
  party: "borrower" | "bank";
}) {
  const [signatureName, setSignatureName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const title =
    party === "borrower"
      ? "Digitally accept loan agreement"
      : "Alta Bank authorized signature";

  const body =
    party === "borrower"
      ? "You are about to digitally accept this Alta Bank Loan Agreement. Your acceptance will become part of the permanent agreement record."
      : "You are signing on behalf of Alta Bank. This will execute the agreement and disburse funds automatically.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-elevated">
        <h3 className="font-serif text-[18px] tracking-tight">{title}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
        <label className="mt-4 block">
          <span className={labelClass}>Legal / display name</span>
          <input
            className={fieldClass}
            value={signatureName}
            onChange={(e) => setSignatureName(e.target.value)}
            placeholder="Type your full legal name"
          />
        </label>
        <label className="mt-4 flex cursor-pointer items-start gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5"
          />
          <span>I confirm this is my legal acceptance of the agreement terms shown in the draft PDF.</span>
        </label>
        {error ? <p className="mt-3 text-[12px] text-destructive">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading || !confirmed || !signatureName.trim()}
            onClick={() => {
              setLoading(true);
              setError(null);
              void onConfirm(signatureName.trim())
                .then(onClose)
                .catch((e: unknown) => {
                  setError(e instanceof Error ? e.message.replace(/^BAD_REQUEST:/, "") : "Unable to sign.");
                })
                .finally(() => setLoading(false));
            }}
            className="rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold disabled:opacity-50"
          >
            {loading ? "Signing…" : "Confirm signature"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DealAgreementWorkspace({
  dealRoomId,
  agreement,
  variant,
}: {
  dealRoomId: string;
  agreement: AgreementWorkspaceContext;
  variant: "user" | "internal";
}) {
  const router = useRouter();
  const saveWorkspace = useServerFn(saveDealRoomAgreementWorkspace);
  const generateDraft = useServerFn(generateDealRoomAgreementDraft);
  const prepareNewDraft = useServerFn(prepareNewDealRoomAgreementDraft);
  const voidDraft = useServerFn(voidDealRoomAgreementDraft);
  const signBorrower = useServerFn(signDealRoomAgreementBorrower);
  const signBank = useServerFn(signDealRoomAgreementBank);

  const [fields, setFields] = useState<AgreementFieldData>(agreement.fieldData);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [signParty, setSignParty] = useState<"borrower" | "bank" | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewBlobRef = useRef<string | null>(null);

  const requiredChecklist = useMemo(
    () => agreement.checklist.filter((c) => c.required && !c.internalOnly),
    [agreement.checklist],
  );

  const refreshPreview = useCallback(async (data: AgreementFieldData) => {
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/deal-rooms/${dealRoomId}/agreement/preview`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldData: data }),
      });
      if (!res.ok) throw new Error("Preview failed");
      const blob = await res.blob();
      if (previewBlobRef.current) URL.revokeObjectURL(previewBlobRef.current);
      const url = URL.createObjectURL(blob);
      previewBlobRef.current = url;
      setPreviewUrl(url);
    } catch {
      setPreviewUrl(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [dealRoomId]);

  useEffect(() => {
    void refreshPreview(fields);
    return () => {
      if (previewBlobRef.current) URL.revokeObjectURL(previewBlobRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- initial preview only

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void refreshPreview(fields);
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fields, refreshPreview]);

  function updateField(key: AgreementFieldKey, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaveError(null);
    try {
      await saveWorkspace({ data: { dealRoomId, fieldData: fields } });
      await router.invalidate();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message.replace(/^BAD_REQUEST:/, "") : "Unable to save.");
    }
  }

  const activeDraft = agreement.activeDraft;
  const downloadHref = activeDraft?.downloadUrl ?? null;

  return (
    <section className="flex min-h-[640px] flex-col lg:min-h-0 lg:flex-1">
      <header className="border-b border-border bg-surface-1/40 px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-[17px] tracking-tight">Agreement Workspace</h2>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {agreement.templateLabel} · Officer-prepared fields populate the official Alta Bank template.
            </p>
          </div>
          {variant === "internal" && agreement.canEditWorkspace && (
            <BankReviewButton label="Save workspace" variant="default" onAction={handleSave} />
          )}
        </div>
        {saveError ? <p className="mt-2 text-[12px] text-destructive">{saveError}</p> : null}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-2">
        {/* Left — preparation */}
        <div className="min-h-0 overflow-y-auto border-b border-border px-4 py-5 sm:px-6 xl:border-b-0 xl:border-r">
          {variant === "internal" ? (
            <>
              <div className="mb-6 rounded-lg border border-border bg-surface-2/40 p-4">
                <div className={labelClass}>Required fields checklist</div>
                <ul className="mt-3 space-y-2">
                  {requiredChecklist.map((item) => (
                    <li key={item.key} className="flex items-center gap-2 text-[13px]">
                      <CheckIcon complete={item.complete} />
                      <span className={item.complete ? "text-foreground" : "text-muted-foreground"}>
                        {item.label}
                      </span>
                    </li>
                  ))}
                </ul>
                {agreement.workspaceLocked ? (
                  <p className="mt-3 text-[12px] text-amber-600 dark:text-amber-400">
                    Workspace locked while an active draft exists. Create a new draft to amend unsigned versions.
                  </p>
                ) : null}
              </div>

              {FIELD_SECTIONS.map((section) => (
                <div key={section.title} className="mb-6">
                  <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {section.title}
                  </h3>
                  <div className="mt-3 space-y-3">
                    {section.keys.map((key) => {
                      const meta = agreement.checklist.find((c) => c.key === key);
                      const internal = meta?.internalOnly;
                      return (
                        <label key={key} className="block">
                          <span className={labelClass}>
                            {meta?.label ?? key}
                            {meta?.required ? " *" : ""}
                            {internal ? " (internal)" : ""}
                          </span>
                          {key === "additionalTerms" || key === "officerNotes" || key === "internalNotes" ? (
                            <textarea
                              rows={3}
                              className={fieldClass}
                              value={fields[key]}
                              disabled={!agreement.canEditWorkspace}
                              onChange={(e) => updateField(key, e.target.value)}
                            />
                          ) : (
                            <input
                              className={fieldClass}
                              value={fields[key]}
                              disabled={!agreement.canEditWorkspace}
                              onChange={(e) => updateField(key, e.target.value)}
                            />
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                {agreement.canGenerate && (
                  <BankReviewButton
                    label="Generate agreement"
                    variant="primary"
                    onAction={async () => {
                      await handleSave();
                      await generateDraft({ data: dealRoomId });
                    }}
                  />
                )}
                {agreement.canCreateNewDraft && (
                  <BankReviewButton
                    label="Create new draft"
                    variant="default"
                    onAction={async () => {
                      await prepareNewDraft({ data: dealRoomId });
                    }}
                  />
                )}
                {activeDraft?.canVoid && (
                  <BankReviewButton
                    label="Void draft"
                    variant="danger"
                    onAction={async () => {
                      await voidDraft({ data: activeDraft.id });
                    }}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <p className="text-[13px] text-muted-foreground">
                Review the loan agreement draft prepared by Alta Bank. Download or print for your records.
                When ready, sign digitally to accept the terms.
              </p>
              {activeDraft ? (
                <div className="rounded-lg border border-border bg-surface-2/40 p-4 text-[13px]">
                  <div className={labelClass}>Active draft</div>
                  <p className="mt-1 font-medium">
                    Version {activeDraft.versionNumber} · {activeDraft.statusLabel}
                  </p>
                  {activeDraft.pdfSha256 ? (
                    <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">
                      SHA-256: {activeDraft.pdfSha256}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-[13px] text-muted-foreground">No agreement draft has been generated yet.</p>
              )}
              {activeDraft?.canSignBorrower && (
                <button
                  type="button"
                  onClick={() => setSignParty("borrower")}
                  className="rounded-md border border-gold/40 bg-gold/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-gold"
                >
                  Sign agreement
                </button>
              )}
            </div>
          )}

          <div className="mt-6 rounded-lg border border-border bg-surface-1/50 p-4">
            <div className={labelClass}>Execution checklist</div>
            <ul className="mt-3 space-y-2">
              {agreement.executionChecklist.map((item) => (
                <li key={item.key} className="flex items-center gap-2 text-[13px]">
                  <CheckIcon complete={item.complete} />
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {variant === "internal" && activeDraft?.canSignBank && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setSignParty("bank")}
                className="rounded-md border border-gold/40 bg-gold/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-gold"
              >
                Alta Bank signature
              </button>
            </div>
          )}

          {agreement.draftHistory.length > 0 && (
            <div className="mt-6">
              <div className={labelClass}>Version history</div>
              <ul className="mt-2 space-y-2">
                {agreement.draftHistory.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-[12px]"
                  >
                    <span>
                      V{d.versionNumber} · {d.statusLabel}
                      {d.generatedAt ? ` · ${new Date(d.generatedAt).toLocaleDateString()}` : ""}
                    </span>
                    {d.downloadUrl ? (
                      <a
                        href={d.downloadUrl}
                        className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:underline"
                      >
                        Download
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right — PDF preview */}
        <div className="flex min-h-[480px] flex-col bg-[#f7f5f0] dark:bg-surface-2/30">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
            <span className={labelClass}>Live PDF preview</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Zoom out"
                onClick={() => setZoom((z) => Math.max(50, z - 10))}
                className="rounded p-1.5 text-muted-foreground hover:bg-surface-2"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{zoom}%</span>
              <button
                type="button"
                aria-label="Zoom in"
                onClick={() => setZoom((z) => Math.min(150, z + 10))}
                className="rounded p-1.5 text-muted-foreground hover:bg-surface-2"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              {downloadHref ? (
                <a
                  href={downloadHref}
                  className="rounded p-1.5 text-muted-foreground hover:bg-surface-2"
                  aria-label="Download draft"
                >
                  <Download className="h-4 w-4" />
                </a>
              ) : previewUrl ? (
                <a
                  href={previewUrl}
                  download="agreement-preview.pdf"
                  className="rounded p-1.5 text-muted-foreground hover:bg-surface-2"
                  aria-label="Download preview"
                >
                  <Download className="h-4 w-4" />
                </a>
              ) : null}
              {previewUrl ? (
                <button
                  type="button"
                  aria-label="Print preview"
                  onClick={() => {
                    const w = window.open(previewUrl, "_blank");
                    w?.print();
                  }}
                  className="rounded p-1.5 text-muted-foreground hover:bg-surface-2"
                >
                  <Printer className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
          <div className="relative min-h-0 flex-1 overflow-auto p-4">
            {previewLoading && !previewUrl ? (
              <p className="text-center text-[13px] text-muted-foreground">Generating preview…</p>
            ) : previewUrl ? (
              <iframe
                title="Agreement PDF preview"
                src={previewUrl}
                className="mx-auto min-h-[600px] w-full max-w-3xl border border-border bg-white shadow-sm"
                style={{ height: `${(600 * zoom) / 100}px`, transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
              />
            ) : (
              <p className="text-center text-[13px] text-muted-foreground">Preview unavailable</p>
            )}
          </div>
        </div>
      </div>

      <SignAgreementDialog
        open={signParty === "borrower"}
        onClose={() => setSignParty(null)}
        party="borrower"
        onConfirm={async (signatureName) => {
          if (!activeDraft) throw new Error("No active draft");
          await signBorrower({
            data: { draftId: activeDraft.id, signatureName, confirmed: true },
          });
          await router.invalidate();
        }}
      />
      <SignAgreementDialog
        open={signParty === "bank"}
        onClose={() => setSignParty(null)}
        party="bank"
        onConfirm={async (signatureName) => {
          if (!activeDraft) throw new Error("No active draft");
          await signBank({
            data: { draftId: activeDraft.id, signatureName, confirmed: true },
          });
          await router.invalidate();
        }}
      />
    </section>
  );
}
