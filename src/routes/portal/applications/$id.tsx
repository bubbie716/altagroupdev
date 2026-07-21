"use client";

import { useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import type { NccParticipantApplicationStatus } from "@prisma/client";
import { PortalPageHeader } from "@/components/ncc/portal/portal-shell";
import {
  fetchStaffParticipantApplication,
  staffAddParticipantApplicationNote,
  staffTransitionParticipantApplication,
} from "@/lib/ncc/ncc-participant-application.functions";

export const Route = createFileRoute("/portal/applications/$id")({
  beforeLoad: async () => {
    const { requireNccStaffAccess } = await import(
      "@/lib/ncc/ncc-participant-application.functions"
    );
    await requireNccStaffAccess();
  },
  loader: ({ params }) => fetchStaffParticipantApplication({ data: { id: params.id } }),
  head: () => ({
    meta: [{ title: "Application Review — NCC Institution Portal" }],
  }),
  component: StaffApplicationDetailRoute,
});

const STAFF_ACTIONS: Array<{ to: NccParticipantApplicationStatus; label: string }> = [
  { to: "UNDER_REVIEW", label: "Mark under review" },
  { to: "INFORMATION_REQUIRED", label: "Request information" },
  { to: "TECHNICAL_REVIEW", label: "Technical review" },
  { to: "APPROVED_FOR_TEST", label: "Approve for TEST" },
  { to: "CERTIFICATION", label: "Move to certification" },
  { to: "APPROVED_FOR_LIVE", label: "Approve for LIVE (admin gate)" },
  { to: "REJECTED", label: "Reject" },
];

function StaffApplicationDetailRoute() {
  const initial = Route.useLoaderData();
  const router = useRouter();
  const [app, setApp] = useState(initial);
  const [reason, setReason] = useState("");
  const [infoNote, setInfoNote] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const format = app.accountIdentifierFormat;

  async function transition(toStatus: NccParticipantApplicationStatus) {
    setBusy(true);
    setError(null);
    try {
      const next = await staffTransitionParticipantApplication({
        data: {
          id: app.id,
          toStatus,
          reason: reason || undefined,
          informationRequestNote: infoNote || undefined,
        },
      });
      setApp(next);
      await router.invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^BAD_REQUEST:/, "") : "Transition failed.");
    } finally {
      setBusy(false);
    }
  }

  async function addNote() {
    if (!note.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const next = await staffAddParticipantApplicationNote({ data: { id: app.id, body: note } });
      setApp(next);
      setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message.replace(/^BAD_REQUEST:/, "") : "Note failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PortalPageHeader
        eyebrow="Staff review"
        title={app.displayName}
        description={`${app.publicReference} · ${app.status.replace(/_/g, " ")}`}
      />

      {error ? <p className="text-[13px] text-[#991b1b]">{error}</p> : null}

      {app.testAccessReady ? (
        <div className="rounded-sm border border-[#dbeafe] bg-[#eff6ff] p-4 text-[13px] text-[#1e3a8a]">
          Institution provisioned for TEST. The owner creates their own TEST credential in Developers
          → API Credentials. Staff never receive API secrets.
        </div>
      ) : null}

      {app.institutionId &&
      (app.status === "CERTIFICATION" || app.status === "APPROVED_FOR_LIVE") ? (
        <div className="rounded-sm border border-[#e5e7eb] bg-white p-4 text-[13px]">
          <Link
            to="/portal/certification/$institutionId"
            params={{ institutionId: app.institutionId }}
            className="font-medium text-[#0c4d32] underline"
          >
            Open certification & LIVE activation
          </Link>
        </div>
      ) : null}

      <section className="grid gap-4 rounded-sm border border-[#e5e7eb] bg-white p-4 text-[13px] sm:grid-cols-2">
        <div>
          <div className="text-[11px] uppercase text-[#9ca3af]">Legal name</div>
          <div>{app.legalName}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-[#9ca3af]">Type</div>
          <div>{app.institutionType}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-[#9ca3af]">Jurisdiction</div>
          <div>{app.countryJurisdiction}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-[#9ca3af]">License</div>
          <div>{app.licenseOrRegistrationNumber}</div>
        </div>
        <div className="sm:col-span-2">
          <div className="text-[11px] uppercase text-[#9ca3af]">Account identifier format</div>
          <div className="mt-1 space-y-1 text-[#374151]">
            <div>{format.displayLabel}</div>
            <div>{format.characterFormatDescription}</div>
            <div className="font-mono text-[12px]">{format.exampleMaskedIdentifier}</div>
            <div>
              Letters: {String(format.containsLetters)} · Numbers: {String(format.containsNumbers)} ·
              Spaces: {String(format.containsSpaces)} · Punctuation:{" "}
              {String(format.containsPunctuation)} · Case-sensitive: {String(format.caseSensitive)}
            </div>
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-[#9ca3af]">Primary contact</div>
          <div>
            {app.primaryContactName} · {app.primaryContactEmail}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase text-[#9ca3af]">Institution id</div>
          <div className="font-mono text-[12px]">{app.institutionId ?? "—"}</div>
        </div>
      </section>

      <section className="space-y-3 rounded-sm border border-[#e5e7eb] bg-white p-4">
        <h3 className="text-[14px] font-semibold">Transitions</h3>
        <label className="block text-[12px] text-[#374151]">
          Reason / note
          <input
            className="mt-1 w-full rounded-sm border border-[#d1d5db] px-3 py-2 text-[13px]"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <label className="block text-[12px] text-[#374151]">
          Information request (applicant-visible)
          <textarea
            className="mt-1 w-full rounded-sm border border-[#d1d5db] px-3 py-2 text-[13px]"
            rows={2}
            value={infoNote}
            onChange={(e) => setInfoNote(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {STAFF_ACTIONS.map((action) => (
            <button
              key={action.to}
              type="button"
              disabled={busy}
              onClick={() => void transition(action.to)}
              className="rounded-sm border border-[#d1d5db] bg-white px-3 py-1.5 text-[12px] font-medium text-[#111827]"
            >
              {action.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-sm border border-[#e5e7eb] bg-white p-4">
        <h3 className="text-[14px] font-semibold">Internal notes (staff only)</h3>
        <div className="space-y-2">
          {app.internalNotes.map((n) => (
            <div key={n.id} className="rounded-sm bg-[#f9fafb] p-3 text-[12px] text-[#374151]">
              {n.body}
              <div className="mt-1 text-[11px] text-[#9ca3af]">{n.createdAt}</div>
            </div>
          ))}
        </div>
        <textarea
          className="w-full rounded-sm border border-[#d1d5db] px-3 py-2 text-[13px]"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button
          type="button"
          disabled={busy || !note.trim()}
          onClick={() => void addNote()}
          className="rounded-sm bg-[#0c4d32] px-3 py-1.5 text-[12px] font-medium text-white"
        >
          Add internal note
        </button>
      </section>

      <section className="rounded-sm border border-[#e5e7eb] bg-white p-4 text-[12px]">
        <h3 className="text-[14px] font-semibold">Transition history</h3>
        <ul className="mt-2 space-y-1 text-[#4b5563]">
          {app.transitions.map((t, i) => (
            <li key={`${t.createdAt}-${i}`}>
              {t.fromStatus} → {t.toStatus}
              {t.reason ? ` · ${t.reason}` : ""} · {t.createdAt}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
