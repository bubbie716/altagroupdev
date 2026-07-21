"use client";

import { useMemo, useState } from "react";
import type { FinancialInstitutionType } from "@prisma/client";
import type { ApplicantApplicationView } from "@/server/ncc/ncc-participant-application.service";
import type { AccountIdentifierFormatProfile } from "@/lib/ncc/ncc-participant-application";
import {
  createParticipantApplicationDraft,
  saveParticipantApplicationDraft,
  submitParticipantApplication,
  respondParticipantInformationRequest,
  withdrawParticipantApplication,
} from "@/lib/ncc/ncc-participant-application.functions";

const INSTITUTION_TYPES: FinancialInstitutionType[] = [
  "BANK",
  "EXCHANGE",
  "BROKERAGE",
  "PAYMENT_PROVIDER",
  "CLEARING_PARTICIPANT",
  "CUSTODIAN",
  "OTHER",
];

type FormState = {
  legalName: string;
  displayName: string;
  institutionType: FinancialInstitutionType;
  countryJurisdiction: string;
  registeredAddress: string;
  websiteUrl: string;
  regulatoryAuthority: string;
  licenseOrRegistrationNumber: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  complianceContactName: string;
  complianceContactEmail: string;
  technicalContactName: string;
  technicalContactEmail: string;
  settlementOpsContactName: string;
  settlementOpsContactEmail: string;
  expectedTransactionVolume: string;
  expectedPeakRate: string;
  expectedLiquidityRequirement: string;
  intendedConnectionMethod: string;
  applicantNotes: string;
  format: AccountIdentifierFormatProfile;
};

function emptyForm(): FormState {
  return {
    legalName: "",
    displayName: "",
    institutionType: "BANK",
    countryJurisdiction: "",
    registeredAddress: "",
    websiteUrl: "",
    regulatoryAuthority: "",
    licenseOrRegistrationNumber: "",
    primaryContactName: "",
    primaryContactEmail: "",
    primaryContactPhone: "",
    complianceContactName: "",
    complianceContactEmail: "",
    technicalContactName: "",
    technicalContactEmail: "",
    settlementOpsContactName: "",
    settlementOpsContactEmail: "",
    expectedTransactionVolume: "",
    expectedPeakRate: "",
    expectedLiquidityRequirement: "",
    intendedConnectionMethod: "Institution API adapter",
    applicantNotes: "",
    format: {
      displayLabel: "",
      minLength: null,
      maxLength: null,
      characterFormatDescription: "",
      exampleMaskedIdentifier: "",
      caseSensitive: true,
      normalizationNotes: "",
      branchCodeRequired: false,
      supportedCurrencies: ["FLR"],
      containsLetters: false,
      containsNumbers: true,
      containsSpaces: false,
      containsPunctuation: false,
      examples: [],
    },
  };
}

function fromView(view: ApplicantApplicationView): FormState {
  return {
    legalName: view.legalName,
    displayName: view.displayName,
    institutionType: view.institutionType,
    countryJurisdiction: view.countryJurisdiction,
    registeredAddress: view.registeredAddress,
    websiteUrl: view.websiteUrl ?? "",
    regulatoryAuthority: view.regulatoryAuthority,
    licenseOrRegistrationNumber: view.licenseOrRegistrationNumber,
    primaryContactName: view.primaryContactName,
    primaryContactEmail: view.primaryContactEmail,
    primaryContactPhone: view.primaryContactPhone ?? "",
    complianceContactName: view.complianceContactName,
    complianceContactEmail: view.complianceContactEmail,
    technicalContactName: view.technicalContactName,
    technicalContactEmail: view.technicalContactEmail,
    settlementOpsContactName: view.settlementOpsContactName,
    settlementOpsContactEmail: view.settlementOpsContactEmail,
    expectedTransactionVolume: view.expectedTransactionVolume ?? "",
    expectedPeakRate: view.expectedPeakRate ?? "",
    expectedLiquidityRequirement: view.expectedLiquidityRequirement ?? "",
    intendedConnectionMethod: view.intendedConnectionMethod ?? "",
    applicantNotes: view.applicantNotes ?? "",
    format: { ...view.accountIdentifierFormat },
  };
}

function toPayload(form: FormState) {
  return {
    ...form,
    websiteUrl: form.websiteUrl || null,
    primaryContactPhone: form.primaryContactPhone || null,
    expectedTransactionVolume: form.expectedTransactionVolume || null,
    expectedPeakRate: form.expectedPeakRate || null,
    expectedLiquidityRequirement: form.expectedLiquidityRequirement || null,
    intendedConnectionMethod: form.intendedConnectionMethod || null,
    applicantNotes: form.applicantNotes || null,
    accountIdentifierFormat: {
      ...form.format,
      examples: (form.format.examples ?? []).filter(Boolean),
    },
  };
}

const fieldClass =
  "mt-1 w-full rounded-sm border border-[#d1d5db] bg-white px-3 py-2 text-[13px] text-[#111827]";
const labelClass = "block text-[12px] font-medium text-[#374151]";

export function NccParticipantApplicationForm({
  initial,
  onChanged,
}: {
  initial?: ApplicantApplicationView | null;
  onChanged?: (view: ApplicantApplicationView) => void;
}) {
  const [form, setForm] = useState<FormState>(() => (initial ? fromView(initial) : emptyForm()));
  const [app, setApp] = useState<ApplicantApplicationView | null>(initial ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseNote, setResponseNote] = useState("");
  const locked = app?.fieldsLocked ?? false;
  const examplesText = useMemo(() => (form.format.examples ?? []).join("\n"), [form.format.examples]);

  function patch(partial: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  function patchFormat(partial: Partial<AccountIdentifierFormatProfile>) {
    setForm((prev) => ({ ...prev, format: { ...prev.format, ...partial } }));
  }

  async function saveDraft() {
    setBusy(true);
    setError(null);
    try {
      const payload = toPayload(form);
      const next = app
        ? await saveParticipantApplicationDraft({ data: { id: app.id, ...payload } })
        : await createParticipantApplicationDraft({ data: payload });
      setApp(next);
      onChanged?.(next);
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^BAD_REQUEST:/, "") : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      let current = app;
      const payload = toPayload(form);
      if (!current) {
        current = await createParticipantApplicationDraft({ data: payload });
      } else if (!current.fieldsLocked) {
        current = await saveParticipantApplicationDraft({ data: { id: current.id, ...payload } });
      }
      const next = await submitParticipantApplication({ data: { id: current.id } });
      setApp(next);
      onChanged?.(next);
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^BAD_REQUEST:/, "") : "Submit failed.");
    } finally {
      setBusy(false);
    }
  }

  async function respond() {
    if (!app) return;
    setBusy(true);
    setError(null);
    try {
      const next = await respondParticipantInformationRequest({
        data: {
          id: app.id,
          responseNote,
          fields: toPayload(form),
        },
      });
      setApp(next);
      onChanged?.(next);
      setResponseNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^BAD_REQUEST:/, "") : "Response failed.");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!app) return;
    setBusy(true);
    setError(null);
    try {
      const next = await withdrawParticipantApplication({ data: { id: app.id } });
      setApp(next);
      onChanged?.(next);
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^BAD_REQUEST:/, "") : "Withdraw failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {app ? (
        <div className="rounded-sm border border-[#e5e7eb] bg-white p-4 text-[13px]">
          <div className="font-medium text-[#111827]">
            {app.publicReference} · {app.status.replace(/_/g, " ")}
          </div>
          {app.informationRequestNote ? (
            <p className="mt-2 text-[#92400e]">Reviewer request: {app.informationRequestNote}</p>
          ) : null}
          {app.rejectionReason ? (
            <p className="mt-2 text-[#991b1b]">Rejected: {app.rejectionReason}</p>
          ) : null}
          {app.testAccessReady ? (
            <div className="mt-3 rounded-sm border border-[#bbf7d0] bg-[#f0fdf4] p-3 text-[#14532d]">
              <p className="font-medium">TEST access is ready</p>
              <p className="mt-1 text-[12px]">
                Sign in to the Institution Portal → Developers → API Credentials and create a TEST
                credential. The secret is shown once to you as the institution owner.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-[13px] text-[#991b1b]">{error}</p> : null}

      <fieldset disabled={locked && app?.status !== "INFORMATION_REQUIRED"} className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Legal name
            <input className={fieldClass} value={form.legalName} onChange={(e) => patch({ legalName: e.target.value })} />
          </label>
          <label className={labelClass}>
            Display name
            <input className={fieldClass} value={form.displayName} onChange={(e) => patch({ displayName: e.target.value })} />
          </label>
          <label className={labelClass}>
            Institution type
            <select
              className={fieldClass}
              value={form.institutionType}
              onChange={(e) => patch({ institutionType: e.target.value as FinancialInstitutionType })}
            >
              {INSTITUTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Country / jurisdiction
            <input
              className={fieldClass}
              value={form.countryJurisdiction}
              onChange={(e) => patch({ countryJurisdiction: e.target.value })}
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Registered address
            <textarea
              className={fieldClass}
              rows={2}
              value={form.registeredAddress}
              onChange={(e) => patch({ registeredAddress: e.target.value })}
            />
          </label>
          <label className={labelClass}>
            Website
            <input className={fieldClass} value={form.websiteUrl} onChange={(e) => patch({ websiteUrl: e.target.value })} />
          </label>
          <label className={labelClass}>
            Regulatory authority
            <input
              className={fieldClass}
              value={form.regulatoryAuthority}
              onChange={(e) => patch({ regulatoryAuthority: e.target.value })}
            />
          </label>
          <label className={labelClass}>
            License / registration number
            <input
              className={fieldClass}
              value={form.licenseOrRegistrationNumber}
              onChange={(e) => patch({ licenseOrRegistrationNumber: e.target.value })}
            />
          </label>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <h3 className="sm:col-span-2 text-[14px] font-semibold text-[#111827]">Contacts</h3>
          {(
            [
              ["primaryContactName", "Primary contact name"],
              ["primaryContactEmail", "Primary contact email"],
              ["primaryContactPhone", "Primary contact phone"],
              ["complianceContactName", "Compliance contact name"],
              ["complianceContactEmail", "Compliance contact email"],
              ["technicalContactName", "Technical contact name"],
              ["technicalContactEmail", "Technical contact email"],
              ["settlementOpsContactName", "Settlement ops contact name"],
              ["settlementOpsContactEmail", "Settlement ops contact email"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className={labelClass}>
              {label}
              <input
                className={fieldClass}
                value={form[key]}
                onChange={(e) => patch({ [key]: e.target.value } as Partial<FormState>)}
              />
            </label>
          ))}
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <h3 className="sm:col-span-2 text-[14px] font-semibold text-[#111827]">
            Account identifier format (institution-specific)
          </h3>
          <p className="sm:col-span-2 text-[12px] text-[#6b7280]">
            NCC treats account identifiers as opaque strings. Describe your format — do not assume Alta Bank
            numbering.
          </p>
          <label className={labelClass}>
            Display label
            <input
              className={fieldClass}
              value={form.format.displayLabel}
              onChange={(e) => patchFormat({ displayLabel: e.target.value })}
            />
          </label>
          <label className={labelClass}>
            Character format description
            <input
              className={fieldClass}
              value={form.format.characterFormatDescription}
              onChange={(e) => patchFormat({ characterFormatDescription: e.target.value })}
            />
          </label>
          <label className={labelClass}>
            Example masked identifier
            <input
              className={fieldClass}
              value={form.format.exampleMaskedIdentifier}
              onChange={(e) => patchFormat({ exampleMaskedIdentifier: e.target.value })}
            />
          </label>
          <label className={labelClass}>
            Examples (one per line)
            <textarea
              className={fieldClass}
              rows={3}
              value={examplesText}
              onChange={(e) =>
                patchFormat({
                  examples: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean),
                })
              }
            />
          </label>
          <label className={labelClass}>
            Min length
            <input
              type="number"
              className={fieldClass}
              value={form.format.minLength ?? ""}
              onChange={(e) =>
                patchFormat({ minLength: e.target.value ? Number(e.target.value) : null })
              }
            />
          </label>
          <label className={labelClass}>
            Max length
            <input
              type="number"
              className={fieldClass}
              value={form.format.maxLength ?? ""}
              onChange={(e) =>
                patchFormat({ maxLength: e.target.value ? Number(e.target.value) : null })
              }
            />
          </label>
          <label className={labelClass}>
            Normalization notes
            <input
              className={fieldClass}
              value={form.format.normalizationNotes ?? ""}
              onChange={(e) => patchFormat({ normalizationNotes: e.target.value })}
            />
          </label>
          <div className="flex flex-wrap gap-4 text-[12px] text-[#374151] sm:col-span-2">
            {(
              [
                ["caseSensitive", "Case sensitive"],
                ["branchCodeRequired", "Branch code required"],
                ["containsLetters", "Contains letters"],
                ["containsNumbers", "Contains numbers"],
                ["containsSpaces", "Contains spaces"],
                ["containsPunctuation", "Contains punctuation"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(form.format[key])}
                  onChange={(e) => patchFormat({ [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Expected transaction volume
            <input
              className={fieldClass}
              value={form.expectedTransactionVolume}
              onChange={(e) => patch({ expectedTransactionVolume: e.target.value })}
            />
          </label>
          <label className={labelClass}>
            Expected peak rate
            <input
              className={fieldClass}
              value={form.expectedPeakRate}
              onChange={(e) => patch({ expectedPeakRate: e.target.value })}
            />
          </label>
          <label className={labelClass}>
            Expected settlement liquidity requirement
            <input
              className={fieldClass}
              value={form.expectedLiquidityRequirement}
              onChange={(e) => patch({ expectedLiquidityRequirement: e.target.value })}
            />
          </label>
          <label className={labelClass}>
            Intended connection method
            <input
              className={fieldClass}
              value={form.intendedConnectionMethod}
              onChange={(e) => patch({ intendedConnectionMethod: e.target.value })}
            />
          </label>
          <label className={`${labelClass} sm:col-span-2`}>
            Applicant notes
            <textarea
              className={fieldClass}
              rows={3}
              value={form.applicantNotes}
              onChange={(e) => patch({ applicantNotes: e.target.value })}
            />
          </label>
        </section>

        <section className="rounded-sm border border-[#e5e7eb] bg-[#f9fafb] p-4 text-[12px] text-[#4b5563]">
          <p className="font-medium text-[#111827]">Required regulatory documents</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {(app?.requiredDocuments ?? [
              "Regulatory license or registration certificate",
              "Proof of registered address",
              "Primary contact identity attestation",
            ]).map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <p className="mt-2">
            Secure private upload will be completed in a follow-on pass using Alta’s existing private
            document storage. Do not email sensitive documents.
          </p>
        </section>
      </fieldset>

      {app?.status === "INFORMATION_REQUIRED" ? (
        <label className={labelClass}>
          Response to reviewer
          <textarea
            className={fieldClass}
            rows={3}
            value={responseNote}
            onChange={(e) => setResponseNote(e.target.value)}
          />
        </label>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {(!app || app.status === "DRAFT" || app.status === "INFORMATION_REQUIRED") && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveDraft()}
            className="rounded-sm border border-[#d1d5db] bg-white px-4 py-2 text-[13px] font-medium text-[#111827]"
          >
            Save draft
          </button>
        )}
        {(!app || app.status === "DRAFT") && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="rounded-sm bg-[#0c4d32] px-4 py-2 text-[13px] font-medium text-white"
          >
            Submit application
          </button>
        )}
        {app?.status === "INFORMATION_REQUIRED" && (
          <button
            type="button"
            disabled={busy || !responseNote.trim()}
            onClick={() => void respond()}
            className="rounded-sm bg-[#0c4d32] px-4 py-2 text-[13px] font-medium text-white"
          >
            Submit response
          </button>
        )}
        {app &&
          !["APPROVED_FOR_TEST", "CERTIFICATION", "APPROVED_FOR_LIVE", "REJECTED", "WITHDRAWN"].includes(
            app.status,
          ) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void withdraw()}
              className="rounded-sm border border-[#fecaca] px-4 py-2 text-[13px] font-medium text-[#991b1b]"
            >
              Withdraw
            </button>
          )}
      </div>
    </div>
  );
}
