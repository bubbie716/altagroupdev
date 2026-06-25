import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, Section } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { LendingSubNav } from "@/components/bank/lending-sub-nav";
import {
  DealStatusBadge,
  MetaLabel,
} from "@/components/bank/deal-room/deal-room-bits";
import { EmptyState } from "@/components/shared/empty-state";
import { Florin } from "@/components/ui/florin";
import {
  MOCK_DEAL_ROOMS,
  formatPercent,
  type DealRoom,
} from "@/lib/bank/deal-rooms-mock";

export const Route = createFileRoute("/bank/lending/deal-rooms/")({
  head: () => ({
    meta: [
      { title: "Secure Deal Rooms — Alta Bank" },
      {
        name: "description",
        content:
          "Active credit negotiations between Alta Bank applicants and the credit desk.",
      },
    ],
  }),
  component: DealRoomDirectoryPage,
});

function DealRoomDirectoryPage() {
  const rooms = MOCK_DEAL_ROOMS;

  return (
    <PageShell
      eyebrow="Alta Bank · Credit Desk"
      title="Deal rooms"
      description="Confidential workspaces between you, your representatives, and the Alta credit desk. Every active facility under negotiation lives here."
    >
      <BankSubNav />
      <LendingSubNav />

      <Section
        action={
          <Link
            to="/bank/lending/apply"
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold hover:text-foreground"
          >
            Start a new facility →
          </Link>
        }
      >
        {rooms.length === 0 ? (
          <EmptyState
            tag="No active rooms"
            title="No Active Deal Rooms"
            description="When you submit a credit application, a deal room is created for you and your assigned officer."
          />
        ) : (
          <ul className="overflow-hidden rounded-xl border border-border bg-surface-1 divide-y divide-border">
            {rooms.map((room) => (
              <li key={room.id}>
                <DealRoomRow room={room} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </PageShell>
  );
}

function DealRoomRow({ room }: { room: DealRoom }) {
  return (
    <Link
      to="/bank/lending/deal-rooms/$dealRoomId"
      params={{ dealRoomId: room.id }}
      className="group grid items-center gap-4 px-5 py-5 transition-colors hover:bg-surface-2/40 sm:grid-cols-[1.4fr_0.9fr_0.9fr_0.7fr_auto] sm:gap-6 sm:px-6"
    >
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <MetaLabel>{room.id}</MetaLabel>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70 sm:inline">
            · {room.lastActivityLabel}
          </span>
        </div>
        <h3 className="mt-1 font-serif text-[18px] leading-tight tracking-tight">
          {room.loanProduct}
        </h3>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {room.company ?? room.applicant}
        </p>
      </div>

      <div className="hidden sm:block">
        <MetaLabel>Proposed</MetaLabel>
        <div className="mt-1 text-[15px]">
          <Florin value={room.proposedAmount} fractionDigits={0} />
        </div>
      </div>

      <div className="hidden sm:block">
        <MetaLabel>Rate</MetaLabel>
        <div className="mt-1 tabular font-mono text-[14px]">
          {formatPercent(room.proposedRate)}
        </div>
      </div>

      <div className="hidden sm:flex sm:items-center sm:gap-2">
        <div className="grid size-7 place-items-center rounded-full border border-gold/40 bg-gold/10 font-mono text-[10px] tracking-wider text-gold">
          {room.officerInitials ?? "AM"}
        </div>
        <div className="text-[12px] text-muted-foreground">
          {room.assignedOfficer}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <DealStatusBadge status={room.status} />
        <span
          aria-hidden
          className="hidden text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground sm:inline"
        >
          →
        </span>
      </div>
    </Link>
  );
}