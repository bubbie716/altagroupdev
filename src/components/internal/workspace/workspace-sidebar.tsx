import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { WorkspaceSidebarPanel } from "@/components/internal/console/workspace-layout";
import { InternalAuditTable } from "@/components/internal/internal-audit-table";
import { RelatedRecordsCompact, type RelatedRecord } from "./related-records";
import type { AuditLogRow } from "@/lib/internal/audit.types";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { florin } from "@/lib/bank/api";
import { displayRelationshipTierLabelFromCode } from "@/lib/bank/relationship-terminology";

export type WorkspaceNotePreview = {
  id: string;
  body: string;
  authorUsername: string;
  createdAt: string;
};

export type WorkspaceDealRoomLink = {
  label: string;
  to: string;
  status?: string;
};

export type WorkspaceRelationshipSummary = {
  score?: number;
  tier?: string;
  totalAssets?: number;
  href: string;
};

export function WorkspaceSidebar({
  quickActions,
  auditRows = [],
  notes = [],
  relatedRecords = [],
  dealRooms = [],
  relationship,
}: {
  quickActions?: ReactNode;
  auditRows?: AuditLogRow[];
  notes?: WorkspaceNotePreview[];
  relatedRecords?: RelatedRecord[];
  dealRooms?: WorkspaceDealRoomLink[];
  relationship?: WorkspaceRelationshipSummary | null;
}) {
  const sections: ReactNode[] = [];

  if (quickActions) {
    sections.push(
      <WorkspaceSidebarPanel key="actions" title="Quick actions">
        <div className="flex flex-col gap-1.5">{quickActions}</div>
      </WorkspaceSidebarPanel>,
    );
  }

  if (relationship) {
    sections.push(
      <WorkspaceSidebarPanel key="ri" title="Relationship">
        <dl className="space-y-1.5 text-[12px]">
          {relationship.score != null ? (
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Score</dt>
              <dd className="tabular-nums font-medium">{relationship.score}</dd>
            </div>
          ) : null}
          {relationship.tier ? (
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Tier</dt>
              <dd>{relationship.tier}</dd>
            </div>
          ) : null}
          {relationship.totalAssets != null ? (
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Assets</dt>
              <dd className="type-finance tabular-nums">{florin(relationship.totalAssets)}</dd>
            </div>
          ) : null}
        </dl>
        <Link
          to={relationship.href as "/"}
          className="mt-2 inline-block font-mono text-[10px] uppercase tracking-[0.12em] text-gold hover:underline"
        >
          View profile →
        </Link>
      </WorkspaceSidebarPanel>,
    );
  }

  if (auditRows.length > 0) {
    sections.push(
      <WorkspaceSidebarPanel key="audit" title="Recent audit">
        <div className="max-h-48 overflow-y-auto">
          <InternalAuditTable rows={auditRows.slice(0, 3)} showAccount={false} />
        </div>
      </WorkspaceSidebarPanel>,
    );
  }

  if (notes.length > 0) {
    sections.push(
      <WorkspaceSidebarPanel key="notes" title="Recent notes">
        <ul className="space-y-2">
          {notes.slice(0, 3).map((note) => (
            <li key={note.id} className="border-b border-border/40 pb-2 last:border-0 last:pb-0">
              <p className="line-clamp-3 text-[11px] leading-relaxed">{note.body}</p>
              <p className="mt-1 font-mono text-[9px] text-muted-foreground">
                {note.authorUsername} · {formatActivityDateTime(note.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      </WorkspaceSidebarPanel>,
    );
  }

  if (relatedRecords.length > 0) {
    sections.push(
      <WorkspaceSidebarPanel key="related" title="Related records">
        <RelatedRecordsCompact records={relatedRecords} />
      </WorkspaceSidebarPanel>,
    );
  }

  if (dealRooms.length > 0) {
    sections.push(
      <WorkspaceSidebarPanel key="dealrooms" title="Deal rooms">
        <ul className="space-y-1.5">
          {dealRooms.map((room) => (
            <li key={room.to}>
              <Link
                to={room.to as "/"}
                className="block text-[12px] text-gold hover:underline"
              >
                {room.label}
              </Link>
              {room.status ? (
                <span className="font-mono text-[9px] uppercase text-muted-foreground">{room.status}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </WorkspaceSidebarPanel>,
    );
  }

  if (sections.length === 0) return null;
  return <>{sections}</>;
}

/** Map RI tier code to customer-facing relationship tier label (Alta Private is separate). */
export function formatRelationshipTier(tier: string): string {
  return displayRelationshipTierLabelFromCode(tier);
}
