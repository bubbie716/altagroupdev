"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { COMPANY_RELATIONSHIP_TIER_LABELS } from "@/lib/bank/company-relationship-intelligence-config";
import { RELATIONSHIP_TIER_LABELS } from "@/lib/bank/relationship-intelligence-config";
import type { ResolvedRelationshipIntegration } from "@/lib/internal/resolved-relationship-integration.types";

const READINESS_LABELS = {
  ELIGIBLE: "Pre-approval eligible",
  NOT_ELIGIBLE: "Pre-approval not eligible",
  NEEDS_REVIEW: "Pre-approval needs review",
} as const;

function integrationSummary(integration: ResolvedRelationshipIntegration) {
  const readiness = integration.bundle.preApprovalReadiness?.readinessStatus;
  if (integration.scope === "company") {
    const panel = integration.bundle.panel;
    return {
      subject: panel.companyName,
      score: panel.relationshipScore,
      tier: COMPANY_RELATIONSHIP_TIER_LABELS[panel.relationshipTier],
      readiness: readiness ? READINESS_LABELS[readiness] : null,
    };
  }
  const panel = integration.bundle.panel;
  return {
    subject: "Personal profile",
    score: panel.relationshipScore,
    tier: RELATIONSHIP_TIER_LABELS[panel.relationshipTier],
    readiness: readiness ? READINESS_LABELS[readiness] : null,
  };
}

export function DealRoomRelationshipContextBar({
  integration,
  children,
}: {
  integration: ResolvedRelationshipIntegration;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const summary = integrationSummary(integration);

  return (
    <div className="border-b border-border bg-surface-1">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-surface-2/40 lg:px-6"
        aria-expanded={expanded}
      >
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Relationship context
          </p>
          <p className="mt-0.5 truncate text-[13px] text-foreground">
            {summary.subject}
            <span className="text-muted-foreground">
              {" "}
              · Score {summary.score} · {summary.tier}
              {summary.readiness ? ` · ${summary.readiness}` : ""}
            </span>
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold">
          {expanded ? "Hide details" : "Show details"}
          {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </span>
      </button>
      {expanded ? (
        <div className="max-h-[min(40vh,22rem)] overflow-y-auto border-t border-border/60 px-4 py-3 lg:px-6">
          {children}
        </div>
      ) : null}
    </div>
  );
}
