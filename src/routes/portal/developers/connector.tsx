"use client";

import { useState, useTransition } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PortalPageHeader } from "@/components/ncc/portal/portal-shell";
import {
  fetchInstitutionConnector,
  saveInstitutionConnector,
} from "@/lib/ncc/ncc-connectivity.functions";

export const Route = createFileRoute("/portal/developers/connector")({
  loader: () => fetchInstitutionConnector(),
  head: () => ({
    meta: [{ title: "Participant Connector — NCC Institution Portal" }],
  }),
  component: ConnectorRoute,
});

function ConnectorRoute() {
  const initial = Route.useLoaderData();
  const [connector, setConnector] = useState(initial.connector);
  const [mode, setMode] = useState<"API" | "DIRECTORY">(connector?.mode ?? "API");
  const [baseUrl, setBaseUrl] = useState(connector?.baseUrl ?? "");
  const [authSecret, setAuthSecret] = useState("");
  const [timeoutMs, setTimeoutMs] = useState(String(connector?.timeoutMs ?? 5000));
  const [certSource, setCertSource] = useState(connector?.certSourceAccountIdentifier ?? "");
  const [certDest, setCertDest] = useState(connector?.certDestinationAccountIdentifier ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <PortalPageHeader
        eyebrow="Developers"
        title="Participant Connector"
        description="Configure how NCC resolves accounts and moves money for your institution. Directory mode resolves identifiers only — an API connector is required for instant settlement."
      />

      {error ? (
        <div className="mb-4 rounded-sm border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[12px] text-[#991b1b]">
          {error}
        </div>
      ) : null}

      <section className="rounded-sm border border-[#e5e7eb] bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-[12px]">
            Mode
            <select
              className="mt-1 w-full rounded-sm border border-[#d1d5db] px-2 py-1.5"
              value={mode}
              onChange={(e) => setMode(e.target.value as "API" | "DIRECTORY")}
            >
              <option value="API">API (real-time resolve + money movement)</option>
              <option value="DIRECTORY">DIRECTORY (spreadsheet resolve only)</option>
            </select>
          </label>
          <label className="text-[12px]">
            Timeout (ms)
            <input
              className="mt-1 w-full rounded-sm border border-[#d1d5db] px-2 py-1.5"
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(e.target.value)}
            />
          </label>
          {mode === "API" ? (
            <>
              <label className="text-[12px] sm:col-span-2">
                Base URL (HTTPS)
                <input
                  className="mt-1 w-full rounded-sm border border-[#d1d5db] px-2 py-1.5"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://connector.example.com"
                />
              </label>
              <label className="text-[12px] sm:col-span-2">
                Auth secret {connector?.hasAuthSecret ? "(leave blank to keep existing)" : ""}
                <input
                  type="password"
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-sm border border-[#d1d5db] px-2 py-1.5"
                  value={authSecret}
                  onChange={(e) => setAuthSecret(e.target.value)}
                />
              </label>
              <label className="text-[12px]">
                Certification TEST source account identifier
                <input
                  className="mt-1 w-full rounded-sm border border-[#d1d5db] px-2 py-1.5 font-mono"
                  value={certSource}
                  onChange={(e) => setCertSource(e.target.value)}
                  placeholder="Your bank’s TEST debit account id"
                />
              </label>
              <label className="text-[12px]">
                Certification TEST destination account identifier
                <input
                  className="mt-1 w-full rounded-sm border border-[#d1d5db] px-2 py-1.5 font-mono"
                  value={certDest}
                  onChange={(e) => setCertDest(e.target.value)}
                  placeholder="Your bank’s TEST credit account id"
                />
              </label>
            </>
          ) : null}
        </div>

        {connector ? (
          <dl className="mt-4 grid gap-2 text-[12px] text-[#4b5563] sm:grid-cols-2">
            <div>
              <dt className="font-medium text-[#111827]">Status</dt>
              <dd>{connector.status}</dd>
            </div>
            <div>
              <dt className="font-medium text-[#111827]">Certification</dt>
              <dd>{connector.certificationStatus}</dd>
            </div>
            <div>
              <dt className="font-medium text-[#111827]">Currency</dt>
              <dd>{connector.supportedCurrency}</dd>
            </div>
            <div>
              <dt className="font-medium text-[#111827]">Last successful check</dt>
              <dd>{connector.lastSuccessfulCheckAt ?? "—"}</dd>
            </div>
          </dl>
        ) : null}

        <button
          type="button"
          disabled={pending}
          className="mt-4 rounded-sm bg-[#0c4d32] px-3 py-2 text-[12px] font-medium text-white disabled:opacity-60"
          onClick={() => {
            setError(null);
            startTransition(async () => {
              try {
                const next = await saveInstitutionConnector({
                  data: {
                    mode,
                    baseUrl: mode === "API" ? baseUrl : null,
                    authSecret: authSecret || null,
                    timeoutMs: Number(timeoutMs) || 5000,
                    certSourceAccountIdentifier: mode === "API" ? certSource || null : null,
                    certDestinationAccountIdentifier: mode === "API" ? certDest || null : null,
                  },
                });
                setConnector(next);
                setAuthSecret("");
              } catch (e) {
                setError(e instanceof Error ? e.message.replace(/^BAD_REQUEST:/, "") : "Save failed.");
              }
            });
          }}
        >
          {pending ? "Saving…" : "Save connector"}
        </button>
      </section>
    </div>
  );
}
