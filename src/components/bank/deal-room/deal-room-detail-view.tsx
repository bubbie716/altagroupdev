import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/site-nav";
import { DealCurrentTerms } from "@/components/bank/deal-room/deal-current-terms";
import { DealStatusBadge } from "@/components/bank/deal-room/deal-room-bits";
import { DealActivityFeed } from "@/components/bank/deal-room/deal-activity-feed";
import { DealContextRail } from "@/components/bank/deal-room/deal-context-rail";
import { DealOfferPanelInternal } from "@/components/bank/deal-room/deal-offer-panel-internal";
import { DealOfferPanelUser } from "@/components/bank/deal-room/deal-offer-panel-user";
import { DealDocumentsPanel } from "@/components/bank/deal-room/deal-documents-panel";
import { DealAgreementWorkspace } from "@/components/bank/deal-room/deal-agreement-workspace";
import { DealRoomTabs, type DealRoomTabId } from "@/components/bank/deal-room/deal-room-tabs";
import type {
  DealRoomDocumentsContext,
  DealRoomMessageRow,
  DealRoomOfferRow,
  DealRoomTermsContext,
} from "@/lib/bank/deal-room-types";
import type { AgreementWorkspaceContext } from "@/lib/agreements/agreement-types";
import { DealRoomOpsPanel } from "@/components/bank/deal-room/deal-room-ops-panel";
import type { DealRoomOpsContext, DealRoomTimelineEvent } from "@/lib/bank/deal-room-ops-types";
import { DealRoomExecutedBanner } from "@/components/bank/deal-room/deal-room-executed-banner";
import type { DealRoomExecutionSummary } from "@/lib/lending/loan-execution-types";
import type { DealRoom } from "@/lib/bank/deal-rooms-mock";

export function DealRoomDetailView({
  room,
  messages,
  offers,
  termsContext,
  documents,
  agreement,
  execution,
  ops,
  officers,
  timeline,
  variant,
  backTo,
  backLabel,
}: {
  room: DealRoom;
  messages: DealRoomMessageRow[];
  offers: DealRoomOfferRow[];
  termsContext: DealRoomTermsContext;
  documents: DealRoomDocumentsContext;
  agreement: AgreementWorkspaceContext;
  execution: DealRoomExecutionSummary | null;
  ops: DealRoomOpsContext | null;
  officers: { id: string; name: string }[];
  timeline: DealRoomTimelineEvent[];
  variant: "user" | "internal";
  backTo: string;
  backLabel: string;
}) {
  const [showContext, setShowContext] = useState(false);
  const [activeTab, setActiveTab] = useState<DealRoomTabId>("conversation");
  const roomClosedForUser = room.status === "closed" || room.status === "declined";
  const roomExecuted = room.status === "executed";

  return (
    <div className="flex h-screen flex-col bg-background">
      <SiteNav />

      <header className="border-b border-border bg-surface-1/80 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            to={backTo}
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground"
          >
            {backLabel}
          </Link>
          <span className="hidden h-4 w-px bg-border sm:inline" aria-hidden />
          <div className="flex min-w-0 flex-1 items-baseline gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {room.id.slice(0, 12)}
            </span>
            <h1 className="truncate font-serif text-[18px] tracking-tight sm:text-[22px]">
              {room.loanProduct}
            </h1>
            <span className="hidden text-[12px] text-muted-foreground sm:inline">
              · {room.company ?? room.applicant}
            </span>
          </div>
          <DealStatusBadge status={room.status} />
          <button
            type="button"
            onClick={() => setShowContext(true)}
            className="rounded-md border border-border bg-surface-2/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground hover:bg-surface-2 lg:hidden"
          >
            Deal
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
        <main className="flex min-h-0 flex-col">
          <div className="border-b border-border px-4 py-4 sm:px-6">
            <DealCurrentTerms status={room.status} terms={termsContext} />
          </div>

          <DealRoomTabs active={activeTab} onChange={setActiveTab} variant={variant} />

          {execution?.isExecuted ? (
            <DealRoomExecutedBanner execution={execution} variant={variant} />
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto">
            {activeTab === "conversation" && (
              <DealActivityFeed
                dealRoomId={room.id}
                messages={messages}
                variant={variant}
                roomClosed={roomClosedForUser || roomExecuted}
              />
            )}

            {activeTab === "offers" &&
              (variant === "user" ? (
                <DealOfferPanelUser
                  dealRoomId={room.id}
                  offers={offers}
                  terms={termsContext}
                  roomClosed={roomClosedForUser || roomExecuted}
                />
              ) : (
                <DealOfferPanelInternal
                  dealRoomId={room.id}
                  offers={offers}
                  terms={termsContext}
                  roomClosed={roomExecuted}
                />
              ))}

            {activeTab === "documents" && (
              <DealDocumentsPanel
                dealRoomId={room.id}
                documents={documents}
                variant={variant}
                roomClosed={roomClosedForUser || roomExecuted}
              />
            )}

            {activeTab === "agreement" && (
              <DealAgreementWorkspace
                dealRoomId={room.id}
                agreement={agreement}
                variant={variant}
              />
            )}

            {activeTab === "operations" && variant === "internal" && ops && (
              <DealRoomOpsPanel
                dealRoomId={room.id}
                ops={ops}
                officers={officers}
                timeline={timeline}
                roomClosed={roomExecuted}
              />
            )}
          </div>
        </main>

        <aside className="hidden min-h-0 overflow-y-auto border-l border-border bg-surface-1/50 px-5 py-6 lg:block">
          <DealContextRail room={room} />
        </aside>
      </div>

      {showContext ? (
        <div className="fixed inset-0 z-50 flex flex-col lg:hidden">
          <button
            type="button"
            aria-label="Close deal context"
            onClick={() => setShowContext(false)}
            className="flex-1 bg-foreground/30 backdrop-blur-sm"
          />
          <div className="max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-border bg-background px-5 py-5 shadow-elevated">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-serif text-[18px] tracking-tight">Deal</h2>
              <button
                type="button"
                onClick={() => setShowContext(false)}
                className="rounded-md border border-border bg-surface-2/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground"
              >
                Close
              </button>
            </div>
            <DealContextRail room={room} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
