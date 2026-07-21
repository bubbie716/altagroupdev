"use client";

import { useState, useTransition } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PortalPageHeader } from "@/components/ncc/portal/portal-shell";
import {
  activateDirectory,
  fetchDirectoryVersions,
  rollbackDirectory,
  uploadDirectoryFile,
} from "@/lib/ncc/ncc-connectivity.functions";

export const Route = createFileRoute("/portal/developers/directory")({
  loader: () => fetchDirectoryVersions(),
  head: () => ({
    meta: [{ title: "Account Directory — NCC Institution Portal" }],
  }),
  component: DirectoryRoute,
});

function DirectoryRoute() {
  const initial = Route.useLoaderData();
  const [versions, setVersions] = useState(initial.versions);
  const [diff, setDiff] = useState<{
    added: number;
    changed: number;
    closed: number;
    unchanged: number;
    rejected: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const next = await fetchDirectoryVersions();
      setVersions(next.versions);
    });
  }

  return (
    <div>
      <PortalPageHeader
        eyebrow="Developers"
        title="Account Directory"
        description="Upload a versioned CSV mapping your public account identifiers to opaque participant references. Activation is manual and atomic. Spreadsheets never move money."
      />

      {error ? (
        <div className="mb-4 rounded-sm border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[12px] text-[#991b1b]">
          {error}
        </div>
      ) : null}

      <section className="mb-6 rounded-sm border border-[#e5e7eb] bg-white p-4 shadow-sm">
        <h2 className="text-[13px] font-semibold text-[#111827]">Upload CSV</h2>
        <p className="mt-1 text-[12px] text-[#6b7280]">
          Required columns: accountIdentifier, participantAccountReference, currency, status,
          canDebit, canCredit. Optional: beneficiaryLabel. Identifiers are preserved exactly
          (leading zeros, punctuation).
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          className="mt-3 block text-[12px]"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setError(null);
            startTransition(async () => {
              try {
                const text = await file.text();
                const result = await uploadDirectoryFile({
                  data: { csvText: text, fileName: file.name },
                });
                setDiff(result.diff);
                refresh();
              } catch (err) {
                setError(
                  err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Upload failed.",
                );
              }
            });
          }}
        />
        {diff ? (
          <p className="mt-3 text-[12px] text-[#374151]">
            Diff — added {diff.added}, changed {diff.changed}, closed {diff.closed}, unchanged{" "}
            {diff.unchanged}, rejected {diff.rejected}. Activate explicitly when ready.
          </p>
        ) : null}
      </section>

      <section className="rounded-sm border border-[#e5e7eb] bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[13px] font-semibold text-[#111827]">Versions</h2>
          <button
            type="button"
            disabled={pending}
            className="rounded-sm border border-[#d1d5db] px-2 py-1 text-[11px] font-medium text-[#374151]"
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  await rollbackDirectory({});
                  refresh();
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message.replace(/^BAD_REQUEST:/, "")
                      : "Rollback failed.",
                  );
                }
              });
            }}
          >
            Rollback to previous
          </button>
        </div>
        <ul className="mt-3 divide-y divide-[#f3f4f6]">
          {versions.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-[12px]">
              <div>
                <div className="font-medium text-[#111827]">
                  v{v.versionNumber} · {v.status}
                </div>
                <div className="text-[#6b7280]">
                  {v.entryCount} entries · {v.fileName ?? "—"} · {v.currency}
                </div>
              </div>
              {v.status === "VALIDATED" || v.status === "SUPERSEDED" || v.status === "ROLLED_BACK" ? (
                <button
                  type="button"
                  disabled={pending}
                  className="rounded-sm bg-[#0c4d32] px-2.5 py-1.5 text-[11px] font-medium text-white disabled:opacity-60"
                  onClick={() => {
                    setError(null);
                    startTransition(async () => {
                      try {
                        await activateDirectory({ data: { versionId: v.id } });
                        refresh();
                      } catch (err) {
                        setError(
                          err instanceof Error
                            ? err.message.replace(/^BAD_REQUEST:/, "")
                            : "Activate failed.",
                        );
                      }
                    });
                  }}
                >
                  Activate
                </button>
              ) : null}
            </li>
          ))}
          {versions.length === 0 ? (
            <li className="py-6 text-[12px] text-[#6b7280]">No directory versions yet.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
