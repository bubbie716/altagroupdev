import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Florin } from "@/components/ui/florin";
import type {
  DealActivityItem,
  DealRoom,
  DealRoomStatus,
  DealRoomTimelineStep,
} from "@/lib/bank/deal-rooms-mock";
import { DEAL_ROOM_STATUS_LABELS, DEAL_ROOM_STATUS_TONES } from "@/lib/bank/deal-rooms-mock";

/* ------------------------------------------------------------------ */
/* Status badge                                                       */
/* ------------------------------------------------------------------ */

const toneClass: Record<string, string> = {
  info: "border-border bg-surface-2 text-foreground",
  warn: "border-gold/40 bg-gold/10 text-gold",
  positive: "border-[color:var(--success)]/40 bg-[color:var(--success)]/10 text-[color:var(--success)]",
  negative: "border-[color:var(--destructive)]/40 bg-[color:var(--destructive)]/10 text-[color:var(--destructive)]",
  muted: "border-border bg-surface-1 text-muted-foreground",
};

export function DealStatusBadge({ status, className }: { status: DealRoomStatus; className?: string }) {
  const tone = DEAL_ROOM_STATUS_TONES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em]",
        toneClass[tone],
        className,
      )}
    >
      <span className="size-1 rounded-full bg-current opacity-70" />
      {DEAL_ROOM_STATUS_LABELS[status]}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Metadata line                                                      */
/* ------------------------------------------------------------------ */

export function MetaRow({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 border-b border-border/40 py-2 last:border-b-0", className)}>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <span className="text-right text-[13px] text-foreground">{children}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Terms comparison block                                             */
/* ------------------------------------------------------------------ */

export function TermsBlock({
  heading,
  amount,
  rate,
  termMonths,
  structure,
  monthlyPayment,
  highlight = false,
  empty = false,
}: {
  heading: string;
  amount: number;
  rate: number;
  termMonths: number;
  structure: string;
  monthlyPayment?: number;
  highlight?: boolean;
  empty?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        highlight ? "border-gold/40 bg-gold/5" : "border-border bg-surface-1/60",
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{heading}</span>
        {highlight ? (
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-gold">Alta</span>
        ) : null}
      </div>
      {empty ? (
        <p className="py-4 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
          Pending proposal
        </p>
      ) : (
        <dl className="space-y-2 text-[13px]">
          <Row label="Amount">
            <Florin value={amount} fractionDigits={0} className="text-[14px] font-semibold" />
          </Row>
          <Row label="Rate">
            <span className="font-mono tabular">
              {rate ? `${rate.toFixed(2)}% / mo` : "—"}
            </span>
          </Row>
          <Row label="Term">
            <span className="font-mono tabular">{termMonths ? `${termMonths} months` : "—"}</span>
          </Row>
          <Row label="Structure">
            <span className="text-right text-[12px] text-muted-foreground">{structure}</span>
          </Row>
          {monthlyPayment !== undefined ? (
            <Row label="Est. payment">
              <Florin value={monthlyPayment} fractionDigits={0} className="text-[13px]" />
            </Row>
          ) : null}
        </dl>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Timeline                                                           */
/* ------------------------------------------------------------------ */

export function DealTimeline({ steps }: { steps: DealRoomTimelineStep[] }) {
  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const isLast = i === steps.length - 1;
        return (
          <li key={s.id} className="relative flex gap-3 pb-4 last:pb-0">
            {!isLast ? (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[7px] top-4 h-full w-px",
                  s.state === "complete" ? "bg-gold/50" : "bg-border",
                )}
              />
            ) : null}
            <span
              aria-hidden
              className={cn(
                "relative z-10 mt-1 size-[15px] shrink-0 rounded-full border-2 bg-background",
                s.state === "complete" && "border-gold bg-gold",
                s.state === "current" && "border-gold",
                s.state === "upcoming" && "border-border",
              )}
            />
            <div className="flex flex-1 items-baseline justify-between gap-3">
              <span
                className={cn(
                  "text-[13px]",
                  s.state === "upcoming" ? "text-muted-foreground" : "text-foreground",
                  s.state === "current" && "font-semibold",
                )}
              >
                {s.label}
              </span>
              {s.date ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {s.date}
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Activity feed item                                                 */
/* ------------------------------------------------------------------ */

const kindLabels: Record<DealActivityItem["kind"], string> = {
  system: "System Update",
  applicant_message: "Applicant Message",
  officer_message: "Officer Message",
  term_sheet: "Term Sheet",
  counterproposal: "Counterproposal",
  document_request: "Document Request",
  contract_draft: "Contract Update",
  approval: "Approval",
  decline: "Decline",
};

const kindAccent: Record<DealActivityItem["kind"], string> = {
  system: "border-l-border",
  applicant_message: "border-l-foreground/40",
  officer_message: "border-l-gold",
  term_sheet: "border-l-gold",
  counterproposal: "border-l-foreground/40",
  document_request: "border-l-border",
  contract_draft: "border-l-gold",
  approval: "border-l-[color:var(--success)]",
  decline: "border-l-[color:var(--destructive)]",
};

function formatTs(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ActivityItem({ item }: { item: DealActivityItem }) {
  return (
    <article
      className={cn(
        "border-l-2 bg-surface-1/40 px-4 py-3 sm:px-5 sm:py-4",
        kindAccent[item.kind],
      )}
    >
      <header className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-semibold text-foreground">{item.actor}</span>
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            {item.actorRole}
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {kindLabels[item.kind]} · {formatTs(item.timestamp)}
        </span>
      </header>
      <h4 className="text-[14px] font-serif text-foreground">{item.title}</h4>
      {item.body ? (
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{item.body}</p>
      ) : null}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Message composer (UI-only)                                         */
/* ------------------------------------------------------------------ */

export function MessageComposer() {
  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      className="rounded-lg border border-border bg-surface-1 p-4 shadow-card"
    >
      <label className="block font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        Submit message to deal room
      </label>
      <textarea
        rows={3}
        placeholder="Communicate with the loan officer or applicant…"
        className="mt-2 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-[13px] leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          className="rounded-md border border-border bg-surface-2/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
        >
          Attach document
        </button>
        <button
          type="submit"
          className="rounded-md border border-gold/50 bg-gold/15 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-gold hover:bg-gold/25"
        >
          Submit message
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Contract package panel                                             */
/* ------------------------------------------------------------------ */

const contractStatusLabels: Record<DealRoom["contract"]["status"], string> = {
  drafting: "Drafting",
  ready_for_review: "Ready for Review",
  awaiting_acceptance: "Awaiting Acceptance",
  accepted: "Accepted",
  finalized: "Finalized",
};

export function ContractStatusLabel({ status }: { status: DealRoom["contract"]["status"] }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
      {contractStatusLabels[status]}
    </span>
  );
}