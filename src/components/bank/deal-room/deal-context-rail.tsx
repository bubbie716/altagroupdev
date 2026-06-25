import { Link } from "@tanstack/react-router";
import { Florin } from "@/components/ui/florin";
import {
  DealStatusBadge,
  DealTimeline,
  MetaLabel,
  TermsBlock,
} from "./deal-room-bits";
import {
  CONTRACT_STATUS_LABELS,
  formatDealDate,
  formatPercent,
  type DealRoom,
} from "@/lib/bank/deal-rooms-mock";

/**
 * Right-hand rail shown alongside the chat. Condenses deal summary,
 * terms, contract status, timeline. Renders inline (mobile shows the
 * same content in a bottom sheet).
 */
export function DealContextRail({ room }: { room: DealRoom }) {
  const t = room.termSheet;
  return (
    <div className="space-y-6">
      <RailSection title="Status">
        <div className="space-y-3">
          <DealStatusBadge status={room.status} />
          <RailRow label="Next action">{room.nextAction}</RailRow>
          <RailRow label="Last update">{room.lastActivityLabel}</RailRow>
        </div>
      </RailSection>

      <RailSection
        title="Terms"
        accessory={<MetaLabel>v{t.version}</MetaLabel>}
      >
        <div className="[&_.grid]:!grid-cols-1 [&_.grid]:gap-3">
          <TermsBlock requested={room.requested} termSheet={t} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-4 text-[12px]">
          <div>
            <MetaLabel>Min payment</MetaLabel>
            <dd className="mt-1">
              <Florin value={t.minimumPayment} fractionDigits={0} />
            </dd>
          </div>
          <div>
            <MetaLabel>Effective</MetaLabel>
            <dd className="mt-1 tabular font-mono text-[12px]">
              {formatDealDate(t.effectiveDate)}
            </dd>
          </div>
        </dl>
        <div className="mt-4 space-y-3 border-t border-border/60 pt-4 text-[12px] leading-relaxed text-muted-foreground">
          <div>
            <MetaLabel>Collateral</MetaLabel>
            <p className="mt-1">{t.collateralNotes}</p>
          </div>
          <div>
            <MetaLabel>Special conditions</MetaLabel>
            <p className="mt-1">{t.specialConditions}</p>
          </div>
        </div>
      </RailSection>

      <RailSection
        title="Contract"
        accessory={
          <span className="rounded-md border border-border bg-surface-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em]">
            {CONTRACT_STATUS_LABELS[room.contractStatus]}
          </span>
        }
      >
        <ol className="space-y-2">
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
            const done =
              order.indexOf(step) <= order.indexOf(room.contractStatus);
            return (
              <li
                key={step}
                className="flex items-center gap-2 text-[12px]"
              >
                <span
                  className={
                    "size-1.5 rounded-full " +
                    (done ? "bg-gold" : "bg-border")
                  }
                  aria-hidden
                />
                <span
                  className={
                    done ? "text-foreground" : "text-muted-foreground"
                  }
                >
                  {CONTRACT_STATUS_LABELS[step]}
                </span>
              </li>
            );
          })}
        </ol>
      </RailSection>

      <RailSection title="Timeline">
        <DealTimeline status={room.status} />
      </RailSection>

      <RailSection title="Officer">
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-full border border-gold/40 bg-gold/10 font-mono text-[10px] tracking-wider text-gold">
            {room.officerInitials ?? "AM"}
          </div>
          <div>
            <div className="font-serif text-[15px] tracking-tight">
              {room.assignedOfficer}
            </div>
            {room.officerTitle ? (
              <div className="text-[11px] text-muted-foreground">
                {room.officerTitle}
              </div>
            ) : null}
            <div className="mt-2 text-[11px] text-muted-foreground">
              Requested:{" "}
              <span className="tabular font-mono text-foreground">
                <Florin value={room.requestedAmount} fractionDigits={0} />
              </span>{" "}
              · Proposed:{" "}
              <span className="tabular font-mono text-foreground">
                <Florin value={room.proposedAmount} fractionDigits={0} />
              </span>{" "}
              @{" "}
              <span className="tabular font-mono text-foreground">
                {formatPercent(room.proposedRate)}
              </span>
            </div>
          </div>
        </div>
      </RailSection>

      <Link
        to="/bank/lending/deal-rooms"
        className="block text-center font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
      >
        ← All deal rooms
      </Link>
    </div>
  );
}

function RailSection({
  title,
  accessory,
  children,
}: {
  title: string;
  accessory?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="mb-3 flex items-baseline justify-between border-b border-border pb-2">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {title}
        </h3>
        {accessory}
      </header>
      <div>{children}</div>
    </section>
  );
}

function RailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <MetaLabel>{label}</MetaLabel>
      <div className="text-right text-[13px]">{children}</div>
    </div>
  );
}