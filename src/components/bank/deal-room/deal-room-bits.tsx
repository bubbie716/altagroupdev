import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Florin } from "@/components/ui/florin";
import {
  DEAL_ROOM_STATUS_LABELS,
  DEAL_ROOM_STATUS_TONE,
  DEAL_TIMELINE_PROGRESS,
  DEAL_TIMELINE_STEPS,
  formatPercent,
  formatDealDateTime,
  type ActivityEvent,
  type DealRoom,
  type DealRoomStatus,
  type DealRoomStatusTone,
  type RequestedTerms,
  type TermSheet,
} from "@/lib/bank/deal-rooms-mock";

/* -------------------------------------------------------------------------- */
/* Status badge                                                                */
/* -------------------------------------------------------------------------- */

const TONE_CLASSES: Record<DealRoomStatusTone, string> = {
  neutral: "border-border bg-surface-2 text-foreground",
  active: "border-gold/30 bg-gold/10 text-gold",
  warn: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  danger: "border-destructive/40 bg-destructive/10 text-destructive",
  muted: "border-border bg-surface-1 text-muted-foreground",
};

export function DealStatusBadge({
  status,
  className,
}: {
  status: DealRoomStatus;
  className?: string;
}) {
  const tone = DEAL_ROOM_STATUS_TONE[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em]",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <span className="size-1 rounded-full bg-current opacity-70" aria-hidden />
      {DEAL_ROOM_STATUS_LABELS[status]}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Metadata helpers                                                            */
/* -------------------------------------------------------------------------- */

export function MetaLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MetaRow({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-2", className)}>
      <MetaLabel>{label}</MetaLabel>
      <div className="text-right text-sm text-foreground">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Terms comparison                                                            */
/* -------------------------------------------------------------------------- */

export function TermsBlock({
  requested,
  termSheet,
  stacked,
}: {
  requested: RequestedTerms;
  termSheet: TermSheet;
  /** Force a single-column layout (for narrow contexts like the rail). */
  stacked?: boolean;
}) {
  return (
    <div className={cn("grid gap-4", !stacked && "sm:grid-cols-2")}>
      <TermColumn title="Requested" subtitle="Counterparty">
        <TermRow label="Amount">
          <Florin value={requested.amount} fractionDigits={0} />
        </TermRow>
        <TermRow label="Rate">
          <span className="tabular font-mono">{formatPercent(requested.rate)}</span>
        </TermRow>
        <TermRow label="Term">
          <span className="tabular font-mono">{requested.termMonths} mo</span>
        </TermRow>
        <TermRow label="Structure">
          <span className="text-[12px]">{requested.paymentStructure}</span>
        </TermRow>
      </TermColumn>
      <TermColumn title="Alta Proposed" subtitle="Credit Desk" accent>
        <TermRow label="Amount">
          <Florin value={termSheet.approvedAmount} fractionDigits={0} />
        </TermRow>
        <TermRow label="Rate">
          <span className="tabular font-mono">{formatPercent(termSheet.interestRate)}</span>
        </TermRow>
        <TermRow label="Term">
          <span className="tabular font-mono">{termSheet.repaymentMonths} mo</span>
        </TermRow>
        <TermRow label="Min. payment">
          <Florin value={termSheet.minimumPayment} fractionDigits={0} />
        </TermRow>
      </TermColumn>
    </div>
  );
}

function TermColumn({
  title,
  subtitle,
  accent,
  children,
}: {
  title: string;
  subtitle: string;
  accent?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        accent ? "border-gold/40 bg-gold/[0.04]" : "border-border bg-surface-1",
      )}
    >
      <div className="flex items-baseline justify-between">
        <div className="font-serif text-base tracking-tight">{title}</div>
        <MetaLabel className={accent ? "text-gold/80" : undefined}>{subtitle}</MetaLabel>
      </div>
      <div className="mt-3 divide-y divide-border/60">{children}</div>
    </div>
  );
}

function TermRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <span className="text-right">{children}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Deal timeline                                                               */
/* -------------------------------------------------------------------------- */

export function DealTimeline({ status }: { status: DealRoomStatus }) {
  const lastCompleted = DEAL_TIMELINE_PROGRESS[status];

  return (
    <ol className="space-y-3">
      {DEAL_TIMELINE_STEPS.map((label, idx) => {
        const done = idx <= lastCompleted;
        const current = idx === lastCompleted + 1;
        return (
          <li key={label} className="flex items-center gap-3">
            <span
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded-full border text-[10px] font-mono",
                done && "border-gold bg-gold text-background",
                !done && current && "border-gold/60 text-gold",
                !done && !current && "border-border text-muted-foreground",
              )}
            >
              {done ? "✓" : idx + 1}
            </span>
            <span
              className={cn(
                "text-[12px]",
                done && "text-foreground",
                !done && current && "text-foreground",
                !done && !current && "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/* Activity feed                                                               */
/* -------------------------------------------------------------------------- */

const ACTIVITY_KIND_LABEL: Record<ActivityEvent["kind"], string> = {
  applicant_message: "Applicant",
  officer_message: "Officer",
  system: "System",
};

const ACTIVITY_KIND_ACCENT: Record<ActivityEvent["kind"], string> = {
  applicant_message: "border-l-foreground/60",
  officer_message: "border-l-gold",
  system: "border-l-border",
};

export function ActivityItem({ event }: { event: ActivityEvent }) {
  return (
    <article
      className={cn(
        "rounded-md border border-border bg-surface-1/80 border-l-2 p-4",
        ACTIVITY_KIND_ACCENT[event.kind],
      )}
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
            {ACTIVITY_KIND_LABEL[event.kind]}
          </span>
          <h4 className="font-serif text-[15px] tracking-tight">{event.title}</h4>
        </div>
        <time className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {formatDealDateTime(event.timestamp)}
        </time>
      </header>
      {event.body ? (
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{event.body}</p>
      ) : null}
      {event.author ? (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="text-foreground">{event.author}</span>
          {event.authorRole ? <span>· {event.authorRole}</span> : null}
        </div>
      ) : null}
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Composer                                                                    */
/* -------------------------------------------------------------------------- */

export function MessageComposer({ disabled }: { disabled?: boolean }) {
  return (
    <form
      className="rounded-lg border border-border bg-surface-1 p-4"
      onSubmit={(e) => e.preventDefault()}
    >
      <MetaLabel>Submit Message</MetaLabel>
      <textarea
        className="mt-2 min-h-[96px] w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
        placeholder="Add a note for the credit desk…"
        disabled={disabled}
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={disabled}
          className="rounded-md border border-border bg-surface-2/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
        >
          + Attach Document
        </button>
        <button
          type="submit"
          disabled={disabled}
          className="rounded-md border border-gold/40 bg-gold/10 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-gold hover:bg-gold/20 disabled:opacity-50"
        >
          Submit Message
        </button>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Deal card (directory)                                                       */
/* -------------------------------------------------------------------------- */

export function DealRoomCard({ room, href }: { room: DealRoom; href: string }) {
  return (
    <a
      href={href}
      className="group block rounded-xl border border-border bg-surface-1/80 p-5 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-elevated"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <MetaLabel>{room.id}</MetaLabel>
          <h3 className="mt-1 font-serif text-lg tracking-tight">{room.loanProduct}</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {room.company ?? room.applicant}
          </p>
        </div>
        <DealStatusBadge status={room.status} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border/60 pt-4 sm:grid-cols-4">
        <CardStat label="Requested">
          <Florin value={room.requestedAmount} fractionDigits={0} />
        </CardStat>
        <CardStat label="Proposed">
          <Florin value={room.proposedAmount} fractionDigits={0} />
        </CardStat>
        <CardStat label="Rate">
          <span className="tabular font-mono text-sm">{formatPercent(room.proposedRate)}</span>
        </CardStat>
        <CardStat label="Officer">
          <span className="text-sm">{room.assignedOfficer}</span>
        </CardStat>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
        <div className="space-y-0.5">
          <MetaLabel>Next Action</MetaLabel>
          <p className="text-[13px] text-foreground">{room.nextAction}</p>
        </div>
        <MetaLabel className="text-right">
          Last activity · {room.lastActivityLabel}
        </MetaLabel>
      </div>
    </a>
  );
}

function CardStat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <MetaLabel>{label}</MetaLabel>
      <div className="mt-1">{children}</div>
    </div>
  );
}