import { Link } from "@tanstack/react-router";
import { displayRelationshipTierLabel } from "@/lib/bank/relationship-terminology";
import { computeCompanyRelationshipProgress } from "@/lib/bank/customer-relationship-display";
import type { RelationshipProfileSummary } from "@/lib/bank/relationship-intelligence-types";
import type { CompanyRelationshipProfileSummary } from "@/lib/bank/company-relationship-intelligence-types";

export function RelationshipQueueCell({
  userId,
  summary,
}: {
  userId: string;
  summary?: RelationshipProfileSummary | null;
}) {
  return (
    <div className="min-w-0">
      {summary ? (
        <p className="text-[12px] tabular-nums">
          {summary.relationshipScore}{" "}
          <span className="text-muted-foreground">
            · {displayRelationshipTierLabel(summary.relationshipTier, summary.relationshipScore)}
          </span>
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">No profile</p>
      )}
      <Link
        to="/internal/relationships/$userId"
        params={{ userId }}
        className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:underline"
      >
        Relationship →
      </Link>
    </div>
  );
}

export function CompanyRelationshipQueueCell({
  companyId,
  summary,
}: {
  companyId: string;
  summary?: CompanyRelationshipProfileSummary | null;
}) {
  return (
    <div className="min-w-0">
      {summary ? (
        <p className="text-[12px] tabular-nums">
          {summary.relationshipScore}{" "}
          <span className="text-muted-foreground">
            ·{" "}
            {
              computeCompanyRelationshipProgress(
                summary.relationshipScore,
                summary.relationshipTier,
              ).currentTierLabel
            }
          </span>
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">No company profile</p>
      )}
      <Link
        to="/internal/companies/$companyId/relationship"
        params={{ companyId }}
        className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:underline"
      >
        Company relationship →
      </Link>
    </div>
  );
}

export function ApplicationRelationshipQueueCell({
  applicantUserId,
  companyId,
  personalSummary,
  companySummary,
}: {
  applicantUserId: string;
  companyId: string | null;
  personalSummary?: RelationshipProfileSummary | null;
  companySummary?: CompanyRelationshipProfileSummary | null;
}) {
  if (companyId) {
    return <CompanyRelationshipQueueCell companyId={companyId} summary={companySummary} />;
  }
  return <RelationshipQueueCell userId={applicantUserId} summary={personalSummary} />;
}

export function RelationshipQueueCallout({ context }: { context: "ALTA_CARD" | "LENDING" }) {
  const copy =
    context === "ALTA_CARD"
      ? "Open an application or review for the full Relationship Intelligence panel, recommendations, and Use Recommendation prefill. Business applications use the company relationship — not the submitter's personal profile."
      : "Open the Secure Deal Room or loan detail for lending signals, pre-approval readiness, and relationship context. Business applications use the company relationship profile.";

  return (
    <div className="mb-6 rounded-lg border border-border/60 bg-surface-2/30 px-4 py-3 text-[13px] text-muted-foreground">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground">
        Relationship Intelligence
      </span>
      <p className="mt-1">{copy}</p>
    </div>
  );
}
