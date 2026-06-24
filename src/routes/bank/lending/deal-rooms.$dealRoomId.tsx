import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell, Section } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { LendingSubNav } from "@/components/bank/lending-sub-nav";
import { Florin } from "@/components/ui/florin";
import {
  ActivityItem,
  ContractStatusLabel,
  DealStatusBadge,
  DealTimeline,
  MessageComposer,
  MetaRow,
  TermsBlock,
} from "@/components/bank/deal-room/deal-room-bits";
import { getDealRoom, type DealRoom } from "@/lib/bank/deal-rooms-mock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/bank/lending/deal-rooms/$dealRoomId")({
  head: () => ({ meta: [{ title: "Deal Room — Alta Bank Lending" }] }),
  loader: ({ params }) => {
    const room = getDealRoom(params.dealRoomId);
    if (!room) throw notFound();
    return { room };
  },
  component: DealRoomDetail,
});

type MobileTab = "activity" | "terms" | "summary";

function DealRoomDetail() {
  const { room } = Route.useLoaderData();
  const [mobileTab, setMobileTab] = useState<MobileTab>("activity");

  const created = new Date(room.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <PageShell
      eyebrow="Alta Bank · Deal Room"
      title={room.company ?? room.applicant}
      description={`${room.product} · ${room.id}`}
    >
      <BankSubNav />
      <LendingSubNav />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/bank/lending/deal-rooms"
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
        >
          ← Back to deal rooms
        </Link>
        <DealStatusBadge status={room.status} />
      </div>

      {/* Mobile tab switcher */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border/60 pb-2 lg:hidden">
        {(
          [
            { id: "activity", label: "Activity" },
            { id: "terms", label: "Terms" },
            { id: "summary", label: "Summary" },
          ] as { id: MobileTab; label: string }[]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMobileTab(t.id)}
            className={cn(
              "rounded-md px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em]",
              mobileTab === t.id ? "bg-surface-2 text-foreground" : "text-muted-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        {/* LEFT — Deal summary */}
        <aside className={cn("space-y-5", mobileTab === "summary" ? "" : "hidden lg:block")}>
          <DealSummaryCard room={room} created={created} />
          <NegotiationStatusCard room={room} />
        </aside>

        {/* CENTER — Activity feed */}
        <main className={cn("min-w-0 space-y-4", mobileTab === "activity" ? "" : "hidden lg:block")}>
          <Section title="Deal activity">
            <div className="space-y-3">
              {room.activity
                .slice()
                .reverse()
                .map((a: DealRoom["activity"][number]) => (
                  <ActivityItem key={a.id} item={a} />
                ))}
            </div>
          </Section>

          <MessageComposer />

          <Section title="Deal timeline" className="mt-8">
            <div className="rounded-xl border border-border bg-surface-1/80 p-5 shadow-card">
              <DealTimeline steps={room.timeline} />
            </div>
          </Section>
        </main>

        {/* RIGHT — Terms + contract + actions */}
        <aside className={cn("space-y-5", mobileTab === "terms" ? "" : "hidden lg:block")}>
          <TermsPanel room={room} />
          <TermSheetPanel room={room} />
          <ContractPackageCard room={room} />
          <RequiredActionsCard room={room} />
        </aside>
      </div>
    </PageShell>
  );
}

function DealSummaryCard({ room, created }: { room: DealRoom; created: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface-1/80 p-5 shadow-card">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Deal information
      </div>
      <h2 className="mt-1 font-serif text-lg text-foreground">{room.id}</h2>
      <div className="mt-4">
        <MetaRow label="Product">{room.product}</MetaRow>
        <MetaRow label="Applicant">{room.applicant}</MetaRow>
        {room.company ? <MetaRow label="Company">{room.company}</MetaRow> : null}
        <MetaRow label="Officer">
          <div className="text-right">
            <div>{room.officer}</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {room.officerTitle}
            </div>
          </div>
        </MetaRow>
        <MetaRow label="Requested">
          <Florin value={room.requested.amount} fractionDigits={0} />
        </MetaRow>
        <MetaRow label="Proposed">
          {room.proposed.amount > 0 ? (
            <Florin value={room.proposed.amount} fractionDigits={0} />
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Pending</span>
          )}
        </MetaRow>
        <MetaRow label="Proposed rate">
          <span className="font-mono tabular">
            {room.proposed.monthlyRate ? `${room.proposed.monthlyRate.toFixed(2)}% / mo` : "—"}
          </span>
        </MetaRow>
        <MetaRow label="Created">{created}</MetaRow>
        <MetaRow label="Last activity">{room.lastActivityLabel}</MetaRow>
      </div>
    </div>
  );
}

function NegotiationStatusCard({ room }: { room: DealRoom }) {
  return (
    <div className="rounded-xl border border-gold/40 bg-gold/5 p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Current status</div>
      <h3 className="mt-2 font-serif text-xl text-foreground">
        {/* Re-use label via badge text */}
        <DealStatusBadge status={room.status} className="!bg-transparent !border-none !p-0 !tracking-[0.06em] !text-foreground !font-serif !text-xl !normal-case" />
      </h3>
      <dl className="mt-4 space-y-2 text-[13px]">
        <div className="flex justify-between gap-3">
          <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Assigned officer</dt>
          <dd className="text-foreground">{room.officer}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Last update</dt>
          <dd className="text-foreground">{room.lastActivityLabel}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Next action</dt>
          <dd className="text-right text-foreground">{room.nextAction}</dd>
        </div>
      </dl>
    </div>
  );
}

function TermsPanel({ room }: { room: DealRoom }) {
  return (
    <section>
      <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Current terms
      </h3>
      <div className="space-y-3">
        <TermsBlock
          heading="Requested terms"
          amount={room.requested.amount}
          rate={room.requested.monthlyRate}
          termMonths={room.requested.termMonths}
          structure={room.requested.paymentStructure}
        />
        <TermsBlock
          heading="Alta proposed terms"
          highlight
          amount={room.proposed.amount}
          rate={room.proposed.monthlyRate}
          termMonths={room.proposed.termMonths}
          structure={room.proposed.paymentStructure}
          monthlyPayment={room.proposedMonthlyPayment}
          empty={room.proposed.amount === 0}
        />
      </div>
    </section>
  );
}

function TermSheetPanel({ room }: { room: DealRoom }) {
  const hasOffer = room.proposed.amount > 0;
  return (
    <div className="rounded-xl border border-border bg-surface-1/80 p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Current term sheet
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">{room.contract.version}</span>
      </div>
      {hasOffer ? (
        <>
          <div className="mt-3 space-y-1.5 text-[13px]">
            <MetaRow label="Approved amount">
              <Florin value={room.proposed.amount} fractionDigits={0} />
            </MetaRow>
            <MetaRow label="Interest rate">
              <span className="font-mono tabular">{room.proposed.monthlyRate.toFixed(2)}% / mo</span>
            </MetaRow>
            <MetaRow label="Repayment">
              <span className="font-mono tabular">{room.proposed.termMonths} months</span>
            </MetaRow>
            <MetaRow label="Min. payment">
              <Florin value={room.proposedMonthlyPayment} fractionDigits={0} />
            </MetaRow>
            <MetaRow label="Collateral">
              <span className="text-right text-[12px] text-muted-foreground">
                {room.contract.collateralNotes}
              </span>
            </MetaRow>
            <MetaRow label="Effective">
              <span>{room.contract.effectiveDate ?? "—"}</span>
            </MetaRow>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <SheetButton label="View term sheet" />
            <SheetButton label="Download PDF" muted />
            <SheetButton label="Request changes" muted />
            <SheetButton label="Accept terms" primary />
          </div>
        </>
      ) : (
        <p className="mt-3 rounded-md border border-dashed border-border bg-background/40 px-4 py-6 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Term sheet pending
        </p>
      )}
    </div>
  );
}

function SheetButton({ label, primary, muted }: { label: string; primary?: boolean; muted?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-md border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors",
        primary && "border-gold/50 bg-gold/15 text-gold hover:bg-gold/25",
        muted && "border-border bg-surface-2/40 text-muted-foreground hover:text-foreground",
        !primary && !muted && "border-border bg-surface-1 text-foreground hover:bg-surface-2/60",
      )}
    >
      {label}
    </button>
  );
}

function ContractPackageCard({ room }: { room: DealRoom }) {
  return (
    <div className="rounded-xl border border-border bg-surface-1/80 p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Contract package
        </span>
        <ContractStatusLabel status={room.contract.status} />
      </div>

      {room.contract.specialConditions.length > 0 ? (
        <div className="mt-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Special conditions
          </div>
          <ul className="mt-2 space-y-1.5">
            {room.contract.specialConditions.map((c) => (
              <li key={c} className="flex gap-2 text-[13px] text-foreground">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-gold/70" aria-hidden />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <SheetButton label="View draft" />
        <SheetButton label="Request changes" muted />
        <SheetButton label="Accept terms" muted />
        <SheetButton label="Sign contract" primary />
      </div>
      <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/80">
        Digital signature integration — Coming Soon
      </p>
    </div>
  );
}

function RequiredActionsCard({ room }: { room: DealRoom }) {
  return (
    <div className="rounded-xl border border-border bg-surface-1/80 p-5 shadow-card">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Required actions
      </div>
      {room.requiredActions.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted-foreground">No actions required at this time.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border/50">
          {room.requiredActions.map((a) => (
            <li key={a.id} className="flex items-baseline justify-between gap-3 py-2">
              <span className="text-[13px] text-foreground">{a.label}</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Due {a.due}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}