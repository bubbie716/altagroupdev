import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PageShell, Section } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { LendingSubNav } from "@/components/bank/lending-sub-nav";
import {
  ActivityItem,
  DealStatusBadge,
  DealTimeline,
  MessageComposer,
  MetaLabel,
  MetaRow,
  TermsBlock,
} from "@/components/bank/deal-room/deal-room-bits";
import { EmptyState } from "@/components/shared/empty-state";
import { Florin } from "@/components/ui/florin";
import { cn } from "@/lib/utils";
import {
  CONTRACT_STATUS_LABELS,
  formatDealDate,
  formatPercent,
  getDealRoom,
  type DealRoom,
} from "@/lib/bank/deal-rooms-mock";

export const Route = createFileRoute("/bank/lending/deal-rooms/$dealRoomId")({
  loader: ({ params }) => {
    const room = getDealRoom(params.dealRoomId);
    if (!room) throw notFound();
    return room;
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData
          ? `${loaderData.loanProduct} — Deal Room — Alta Bank`
          : "Deal Room — Alta Bank",
      },
    ],
  }),
  notFoundComponent: () => (
    <PageShell eyebrow="Alta Bank · Lending" title="Deal Room Not Found">
      <EmptyState
        tag="404"
        title="This deal room is not available"
        description="It may have been closed, archived, or is restricted to another counterparty."
        action={
          <Link
            to="/bank/lending/deal-rooms"
            className="rounded-md border border-border bg-surface-2 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-foreground"
          >
            Back to Deal Rooms
          </Link>
        }
      />
    </PageShell>
  ),
  component: DealRoomDetailPage,
});

type MobileTab = "activity" | "terms" | "summary";

function DealRoomDetailPage() {
  const room = Route.useLoaderData();
  const [mobileTab, setMobileTab] = useState<MobileTab>("activity");

  return (
    <PageShell
      eyebrow={`Deal Room · ${room.id}`}
      title={room.loanProduct}
      description={`${room.company ?? room.applicant} · negotiating with Alta Bank Credit Desk.`}
    >
      <BankSubNav />
      <LendingSubNav />

      {/* Mobile tab switcher */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border/60 pb-2 lg:hidden">
        {(
          [
            { id: "activity", label: "Activity" },
            { id: "terms", label: "Terms" },
            { id: "summary", label: "Summary" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMobileTab(t.id)}
            className={cn(
              "rounded-md px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors",
              mobileTab === t.id
                ? "bg-surface-2 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        {/* LEFT — Deal Summary */}
        <aside
          className={cn(
            "space-y-4",
            mobileTab === "summary" ? "block" : "hidden",
            "lg:block",
          )}
        >
          <LeftSummary room={room} />
        </aside>

        {/* CENTER — Activity feed */}
        <section
          className={cn(
            "space-y-4",
            mobileTab === "activity" ? "block" : "hidden",
            "lg:block",
          )}
        >
          <NegotiationStatusCard room={room} />
          <Section title="Deal Activity">
            {room.activity.length === 0 ? (
              <EmptyState
                tag="No activity"
                title="No Messages Yet"
                description="The credit desk will post here as your application progresses."
                size="compact"
              />
            ) : (
              <div className="space-y-3">
                {room.activity.map((event: typeof room.activity[number]) => (
                  <ActivityItem key={event.id} event={event} />
                ))}
              </div>
            )}
          </Section>
          <MessageComposer />
        </section>

        {/* RIGHT — Terms, contract, actions */}
        <aside
          className={cn(
            "space-y-4",
            mobileTab === "terms" ? "block" : "hidden",
            "lg:block",
          )}
        >
          <RightTermsPanel room={room} />
        </aside>
      </div>
    </PageShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Left panel                                                                  */
/* -------------------------------------------------------------------------- */

function LeftSummary({ room }: { room: DealRoom }) {
  return (
    <>
      <div className="rounded-xl border border-border bg-surface-1 p-5">
        <MetaLabel>Deal Information</MetaLabel>
        <h3 className="mt-2 font-serif text-lg tracking-tight">{room.loanProduct}</h3>
        <div className="mt-4 divide-y divide-border/60">
          <MetaRow label="Applicant">{room.applicant}</MetaRow>
          {room.company ? <MetaRow label="Company">{room.company}</MetaRow> : null}
          <MetaRow label="Officer">{room.assignedOfficer}</MetaRow>
          <MetaRow label="Requested">
            <Florin value={room.requestedAmount} fractionDigits={0} />
          </MetaRow>
          <MetaRow label="Proposed">
            <Florin value={room.proposedAmount} fractionDigits={0} />
          </MetaRow>
          <MetaRow label="Proposed Rate">
            <span className="tabular font-mono">{formatPercent(room.proposedRate)}</span>
          </MetaRow>
          <MetaRow label="Created">{formatDealDate(room.createdAt)}</MetaRow>
          <MetaRow label="Last Activity">{room.lastActivityLabel}</MetaRow>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface-1 p-5">
        <MetaLabel>Deal Timeline</MetaLabel>
        <div className="mt-4">
          <DealTimeline status={room.status} />
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Negotiation status card (top of center)                                     */
/* -------------------------------------------------------------------------- */

function NegotiationStatusCard({ room }: { room: DealRoom }) {
  return (
    <div className="rounded-xl border border-gold/30 bg-gold/[0.04] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <MetaLabel>Current Status</MetaLabel>
          <div className="mt-2 flex items-center gap-3">
            <DealStatusBadge status={room.status} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
          <div>
            <MetaLabel>Assigned Officer</MetaLabel>
            <div className="mt-1 text-sm">{room.assignedOfficer}</div>
          </div>
          <div>
            <MetaLabel>Last Update</MetaLabel>
            <div className="mt-1 text-sm">{room.lastActivityLabel}</div>
          </div>
          <div>
            <MetaLabel>Next Action</MetaLabel>
            <div className="mt-1 text-sm">{room.nextAction}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Right panel                                                                 */
/* -------------------------------------------------------------------------- */

function RightTermsPanel({ room }: { room: DealRoom }) {
  return (
    <>
      <div className="rounded-xl border border-border bg-surface-1 p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-serif text-lg tracking-tight">Current Terms</h3>
          <MetaLabel>v{room.termSheet.version}</MetaLabel>
        </div>
        <div className="mt-4">
          <TermsBlock requested={room.requested} termSheet={room.termSheet} />
        </div>
      </div>

      <TermSheetPanel room={room} />
      <ContractPackagePanel room={room} />
      <RequiredActionsPanel room={room} />
    </>
  );
}

function TermSheetPanel({ room }: { room: DealRoom }) {
  const t = room.termSheet;
  return (
    <div className="rounded-xl border border-border bg-surface-1 p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-serif text-lg tracking-tight">Current Term Sheet</h3>
        <MetaLabel>v{t.version}</MetaLabel>
      </div>
      <div className="mt-4 divide-y divide-border/60">
        <MetaRow label="Approved Amount">
          <Florin value={t.approvedAmount} fractionDigits={0} />
        </MetaRow>
        <MetaRow label="Interest Rate">
          <span className="tabular font-mono">{formatPercent(t.interestRate)}</span>
        </MetaRow>
        <MetaRow label="Repayment">
          <span className="tabular font-mono">{t.repaymentMonths} months</span>
        </MetaRow>
        <MetaRow label="Min. Payment">
          <Florin value={t.minimumPayment} fractionDigits={0} />
        </MetaRow>
        <MetaRow label="Effective">{formatDealDate(t.effectiveDate)}</MetaRow>
      </div>
      <div className="mt-4 space-y-3 border-t border-border/60 pt-4 text-[12px] leading-relaxed text-muted-foreground">
        <div>
          <MetaLabel>Collateral</MetaLabel>
          <p className="mt-1">{t.collateralNotes}</p>
        </div>
        <div>
          <MetaLabel>Special Conditions</MetaLabel>
          <p className="mt-1">{t.specialConditions}</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <ActionButton>View Term Sheet</ActionButton>
        <ActionButton>Download PDF</ActionButton>
        <ActionButton>Request Changes</ActionButton>
        <ActionButton primary>Accept Terms</ActionButton>
      </div>
    </div>
  );
}

function ContractPackagePanel({ room }: { room: DealRoom }) {
  return (
    <div className="rounded-xl border border-border bg-surface-1 p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-serif text-lg tracking-tight">Contract Package</h3>
        <span className="rounded-md border border-border bg-surface-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em]">
          {CONTRACT_STATUS_LABELS[room.contractStatus]}
        </span>
      </div>
      <ol className="mt-4 space-y-2">
        {(
          [
            "drafting",
            "ready_for_review",
            "awaiting_acceptance",
            "accepted",
            "finalized",
          ] as const
        ).map((step) => {
          const order = [
            "drafting",
            "ready_for_review",
            "awaiting_acceptance",
            "accepted",
            "finalized",
          ];
          const done = order.indexOf(step) <= order.indexOf(room.contractStatus);
          return (
            <li key={step} className="flex items-center gap-2 text-[12px]">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  done ? "bg-gold" : "bg-border",
                )}
                aria-hidden
              />
              <span className={done ? "text-foreground" : "text-muted-foreground"}>
                {CONTRACT_STATUS_LABELS[step]}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <ActionButton>View Draft</ActionButton>
        <ActionButton>Request Changes</ActionButton>
        <ActionButton>Accept Terms</ActionButton>
        <ActionButton primary>Sign Contract</ActionButton>
      </div>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Digital Signature Integration · Coming Soon
      </p>
    </div>
  );
}

function RequiredActionsPanel({ room }: { room: DealRoom }) {
  return (
    <div className="rounded-xl border border-border bg-surface-1 p-5">
      <h3 className="font-serif text-lg tracking-tight">Required Actions</h3>
      <p className="mt-2 text-[13px] text-muted-foreground">{room.nextAction}</p>
      <div className="mt-4 flex flex-col gap-2">
        <ActionButton primary>Respond to Officer</ActionButton>
        <ActionButton>Upload Document</ActionButton>
      </div>
    </div>
  );
}

function ActionButton({
  children,
  primary,
}: {
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-md border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors",
        primary
          ? "border-gold/40 bg-gold/10 text-gold hover:bg-gold/20"
          : "border-border bg-surface-2/60 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}