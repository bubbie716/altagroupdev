"use client";

import { useState, useTransition } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PortalPageHeader } from "@/components/ncc/portal/portal-shell";
import {
  createDeveloperCredential,
  fetchDeveloperCredentials,
  revokeDeveloperCredential,
  rotateDeveloperCredential,
} from "@/lib/ncc/ncc-developer.functions";
import { NCC_API_SCOPES } from "@/lib/ncc/ncc-api-scopes";

export const Route = createFileRoute("/portal/developers/api-credentials")({
  loader: () => fetchDeveloperCredentials(),
  head: () => ({
    meta: [{ title: "API Credentials — NCC Institution Portal" }],
  }),
  component: ApiCredentialsRoute,
});

function ApiCredentialsRoute() {
  const initial = Route.useLoaderData();
  const [credentials, setCredentials] = useState(initial.credentials);
  const [secretOnce, setSecretOnce] = useState<string | null>(null);
  const [name, setName] = useState("Production API");
  const [environment, setEnvironment] = useState<"LIVE" | "TEST">("LIVE");
  const [scopes, setScopes] = useState<string[]>([
    "institution:read",
    "routing:read",
    "accounts:read",
    "settlements:read",
    "settlements:create",
  ]);
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const next = await fetchDeveloperCredentials();
      setCredentials(next.credentials);
    });
  }

  return (
    <div>
      <PortalPageHeader
        eyebrow="Developers"
        title="API Credentials"
        description="Secrets are shown once at creation or rotation. NCC stores only a one-way hash."
      />

      {secretOnce ? (
        <div className="mb-4 rounded-sm border border-[#fde68a] bg-[#fffbeb] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#92400e]">
            Copy this secret now
          </div>
          <code className="mt-2 block break-all text-[12px] text-[#78350f]">{secretOnce}</code>
        </div>
      ) : null}

      <section className="mb-6 rounded-sm border border-[#e5e7eb] bg-white p-4 shadow-sm">
        <h2 className="text-[13px] font-semibold text-[#111827]">Create credential</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-[12px]">
            Name
            <input
              className="mt-1 w-full rounded-sm border border-[#d1d5db] px-2 py-1.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="text-[12px]">
            Environment
            <select
              className="mt-1 w-full rounded-sm border border-[#d1d5db] px-2 py-1.5"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as "LIVE" | "TEST")}
            >
              <option value="LIVE">LIVE</option>
              <option value="TEST">TEST</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {NCC_API_SCOPES.map((scope) => {
            const checked = scopes.includes(scope);
            return (
              <label key={scope} className="flex items-center gap-1 text-[11px] text-[#374151]">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setScopes((prev) =>
                      checked ? prev.filter((s) => s !== scope) : [...prev, scope],
                    )
                  }
                />
                {scope}
              </label>
            );
          })}
        </div>
        <button
          type="button"
          disabled={pending}
          className="mt-4 rounded-sm bg-[#0c4d32] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-60"
          onClick={() =>
            startTransition(async () => {
              const created = await createDeveloperCredential({
                data: {
                  name,
                  environment,
                  scopes,
                },
              });
              setSecretOnce(created.authorizationHint);
              refresh();
            })
          }
        >
          Create credential
        </button>
      </section>

      <section className="rounded-sm border border-[#e5e7eb] bg-white shadow-sm">
        <table className="w-full text-left text-[12px]">
          <thead className="border-b border-[#e5e7eb] bg-[#f9fafb] text-[10px] uppercase tracking-[0.12em] text-[#6b7280]">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Prefix</th>
              <th className="px-3 py-2">Env</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Last used</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {credentials.map((row: (typeof credentials)[number]) => (
              <tr key={row.id} className="border-b border-[#f3f4f6]">
                <td className="px-3 py-2 font-medium">{row.name}</td>
                <td className="px-3 py-2 font-mono text-[11px]">{row.keyPrefix}</td>
                <td className="px-3 py-2">{row.environment}</td>
                <td className="px-3 py-2">{row.status}</td>
                <td className="px-3 py-2">{row.lastUsedAt ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  {row.status === "ACTIVE" ? (
                    <span className="inline-flex gap-2">
                      <button
                        type="button"
                        className="text-[#0c4d32]"
                        onClick={() =>
                          startTransition(async () => {
                            const rotated = await rotateDeveloperCredential({
                              data: { credentialId: row.id },
                            });
                            setSecretOnce(rotated.authorizationHint);
                            refresh();
                          })
                        }
                      >
                        Rotate
                      </button>
                      <button
                        type="button"
                        className="text-[#b91c1c]"
                        onClick={() =>
                          startTransition(async () => {
                            await revokeDeveloperCredential({ data: { credentialId: row.id } });
                            refresh();
                          })
                        }
                      >
                        Revoke
                      </button>
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
