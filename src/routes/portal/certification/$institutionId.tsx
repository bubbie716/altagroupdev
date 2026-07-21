"use client";

import { useState, useTransition } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { PortalPageHeader } from "@/components/ncc/portal/portal-shell";
import {
  executeInstitutionCertification,
  fetchCertificationRun,
  fetchLivePromotionGates,
  promoteInstitutionLive,
  startInstitutionCertification,
} from "@/lib/ncc/ncc-connectivity.functions";

export const Route = createFileRoute("/portal/certification/$institutionId")({
  beforeLoad: async () => {
    const { requireNccStaffAccess } = await import(
      "@/lib/ncc/ncc-participant-application.functions"
    );
    await requireNccStaffAccess();
  },
  loader: async ({ params }) => {
    const [run, gates] = await Promise.all([
      fetchCertificationRun({ data: { institutionId: params.institutionId } }),
      fetchLivePromotionGates({ data: { institutionId: params.institutionId } }),
    ]);
    return { run, gates, institutionId: params.institutionId };
  },
  head: () => ({
    meta: [{ title: "Certification — NCC Institution Portal" }],
  }),
  component: CertificationRoute,
});

function CertificationRoute() {
  const initial = Route.useLoaderData();
  const router = useRouter();
  const [run, setRun] = useState(initial.run);
  const [gates, setGates] = useState(initial.gates);
  const [error, setError] = useState<string | null>(null);
  const [promoResult, setPromoResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <PortalPageHeader
        eyebrow="Staff"
        title="Certification & LIVE activation"
        description="Certification runs only against the participant TEST connector. LIVE promotion activates routing and a zero-balance settlement account — never seeds the operating float or issues credentials."
      />

      {error ? (
        <div className="mb-4 rounded-sm border border-[#fecaca] bg-[#fef2f2] px-3 py-2 text-[12px] text-[#991b1b]">
          {error}
        </div>
      ) : null}
      {promoResult ? (
        <div className="mb-4 rounded-sm border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2 text-[12px] text-[#166534]">
          {promoResult}
        </div>
      ) : null}

      <section className="mb-6 rounded-sm border border-[#e5e7eb] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending}
            className="rounded-sm bg-[#0c4d32] px-3 py-2 text-[12px] font-medium text-white disabled:opacity-60"
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  const started = await startInstitutionCertification({
                    data: { institutionId: initial.institutionId },
                  });
                  const finished = await executeInstitutionCertification({
                    data: { runId: started.id },
                  });
                  setRun(finished);
                  const nextGates = await fetchLivePromotionGates({
                    data: { institutionId: initial.institutionId },
                  });
                  setGates(nextGates);
                  await router.invalidate();
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message.replace(/^BAD_REQUEST:/, "") : "Certification failed.",
                  );
                }
              });
            }}
          >
            {pending ? "Running…" : "Start & run certification"}
          </button>
          <span className="text-[12px] text-[#6b7280]">
            Latest: {run?.status ?? "none"} {run?.completedAt ? `· ${run.completedAt}` : ""}
          </span>
        </div>

        {run?.checks?.length ? (
          <ul className="mt-4 divide-y divide-[#f3f4f6]">
            {run.checks.map((c) => (
              <li key={c.id} className="flex justify-between gap-3 py-2 text-[12px]">
                <span className="font-medium text-[#111827]">{c.checkKey}</span>
                <span className="text-[#4b5563]">
                  {c.status}
                  {c.detail ? ` — ${c.detail}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[12px] text-[#6b7280]">No certification run yet.</p>
        )}
      </section>

      <section className="rounded-sm border border-[#e5e7eb] bg-white p-4 shadow-sm">
        <h2 className="text-[13px] font-semibold text-[#111827]">LIVE promotion gates</h2>
        <ul className="mt-2 list-disc pl-5 text-[12px] text-[#374151]">
          {gates.blockers.length === 0 ? (
            <li>All gates passed</li>
          ) : (
            gates.blockers.map((b) => <li key={b}>{b}</li>)
          )}
        </ul>
        <button
          type="button"
          disabled={pending || !gates.ok}
          className="mt-4 rounded-sm bg-[#0c4d32] px-3 py-2 text-[12px] font-medium text-white disabled:opacity-60"
          onClick={() => {
            setError(null);
            setPromoResult(null);
            startTransition(async () => {
              try {
                const result = await promoteInstitutionLive({
                  data: { institutionId: initial.institutionId },
                });
                setPromoResult(
                  `LIVE active. Routing ${result.routingNumber}. Settlement account ${result.settlementAccountId} at ${result.ledgerBalance}. Owner may now create LIVE credentials.`,
                );
                const nextGates = await fetchLivePromotionGates({
                  data: { institutionId: initial.institutionId },
                });
                setGates(nextGates);
                await router.invalidate();
              } catch (e) {
                setError(
                  e instanceof Error ? e.message.replace(/^BAD_REQUEST:/, "") : "Promotion failed.",
                );
              }
            });
          }}
        >
          Confirm LIVE activation
        </button>
      </section>
    </div>
  );
}
