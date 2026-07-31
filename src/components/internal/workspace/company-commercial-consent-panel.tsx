"use client";

import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { fetchCompanyCommercialConsentSummary } from "@/lib/legal/product-consent.functions";
import { WorkspaceField, WorkspaceFieldGrid } from "@/components/internal/workspace/workspace-fields";
import { isUiLabMode } from "@/lib/auth/ui-lab";
import { getUiLabParty } from "@/lib/bank/ui-lab-party-catalog";

function formatTs(value: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function CompanyCommercialConsentPanel({ companyId }: { companyId: string }) {
  const fetchSummary = useServerFn(fetchCompanyCommercialConsentSummary);
  const [summary, setSummary] = useState<Awaited<
    ReturnType<typeof fetchCompanyCommercialConsentSummary>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isUiLabMode()) {
      const party = getUiLabParty(companyId);
      const companyName = party?.name ?? "UI Lab Company";
      setSummary({
        companyId,
        companyName,
        commercial: {
          scope: "COMMERCIAL",
          label: "Commercial banking",
          status: "Current",
          currentVersions: ["AB-LEGAL-002 v1.1", "AB-LEGAL-004 v1.0", "AB-LEGAL-005 v1.1"],
          acceptedVersions: ["AB-LEGAL-002 v1.1", "AB-LEGAL-004 v1.0", "AB-LEGAL-005 v1.1"],
          acceptedAt: "2026-07-01T12:00:00.000Z",
          acceptanceSemantics: ["Agreed", "Agreed", "Acknowledged"],
          sourceSite: "bank",
          companyId,
          companyName,
          subjectKey: `company:${companyId}`,
          actorUserId: "ui-lab-user",
          technical: [],
        },
        history: [
          {
            documentId: "AB-LEGAL-002",
            title: "Business Deposit Account Agreement",
            version: "1.1",
            acceptanceType: "Agreed",
            actorUserId: "ui-lab-user",
            acceptedAt: "2026-07-01T12:00:00.000Z",
            sourceSite: "bank",
            supersededAt: null,
          },
        ],
      });
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const next = await fetchSummary({ data: companyId });
        if (!cancelled) setSummary(next);
      } catch {
        if (!cancelled) setError("Unable to load commercial consent status.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, fetchSummary]);

  if (error) {
    return <p className="text-[12px] text-muted-foreground">{error}</p>;
  }
  if (!summary) {
    return <p className="text-[12px] text-muted-foreground">Loading commercial consent…</p>;
  }

  return (
    <div className="space-y-3 text-[12px]">
      <WorkspaceFieldGrid columns={2}>
        <WorkspaceField label="Status">{summary.commercial.status}</WorkspaceField>
        <WorkspaceField label="Accepted at">
          {formatTs(summary.commercial.acceptedAt)}
        </WorkspaceField>
        <WorkspaceField label="Source site">
          {summary.commercial.sourceSite ?? "—"}
        </WorkspaceField>
        <WorkspaceField label="Accepted by">
          {summary.commercial.actorUserId === "ui-lab-user"
            ? "Carter Townshend (owner)"
            : summary.commercial.actorUserId
              ? "Authorized representative"
              : "—"}
        </WorkspaceField>
        <WorkspaceField label="Legal company">{summary.companyName}</WorkspaceField>
      </WorkspaceFieldGrid>
      <p className="text-[11px] text-muted-foreground">
        Required: {summary.commercial.currentVersions.join(", ")}
      </p>
      <p className="text-[11px] text-muted-foreground">
        Accepted: {summary.commercial.acceptedVersions.join(", ") || "—"}
      </p>
      {summary.history.length > 0 ? (
        <div>
          <p className="mb-1.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Acceptance history
          </p>
          <ul className="space-y-1.5">
            {summary.history.map((row) => (
              <li key={`${row.documentId}-${row.version}-${row.acceptedAt}`}>
                {row.title} v{row.version} · {row.acceptanceType} · {formatTs(row.acceptedAt)}
                {row.supersededAt ? " · superseded" : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-muted-foreground">No commercial acceptances recorded for this company.</p>
      )}
      <p className="text-[11px] text-muted-foreground">
        Staff cannot fabricate or impersonate company consent.
      </p>
    </div>
  );
}
