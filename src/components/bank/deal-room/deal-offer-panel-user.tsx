import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BankReviewButton } from "@/components/bank/bank-review-button";
import { DealOfferTimeline } from "@/components/bank/deal-room/deal-offer-timeline";
import {
  acceptDealRoomOfferRecord,
  rejectDealRoomOfferRecord,
  submitApplicantCounterOffer,
} from "@/lib/bank/deal-room.functions";
import type { DealRoomOfferRow, DealRoomTermsContext } from "@/lib/bank/deal-room-types";
import { MAX_DEAL_ROOM_TERM_MONTHS } from "@/lib/bank/deal-room-types";
import { cn } from "@/lib/utils";

const fieldClass =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px]";
const labelClass = "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground";

export function DealOfferPanelUser({
  dealRoomId,
  offers,
  terms,
  roomClosed,
}: {
  dealRoomId: string;
  offers: DealRoomOfferRow[];
  terms: DealRoomTermsContext;
  roomClosed: boolean;
}) {
  const router = useRouter();
  const acceptOffer = useServerFn(acceptDealRoomOfferRecord);
  const rejectOffer = useServerFn(rejectDealRoomOfferRecord);
  const submitCounter = useServerFn(submitApplicantCounterOffer);
  const [showCounterForm, setShowCounterForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const activeOfficerOffer = offers.find(
    (o) => o.isActive && o.offerType === "officer_offer",
  );

  async function invalidate() {
    await router.invalidate();
  }

  return (
    <section className="space-y-6 border-b border-border bg-surface-1/40 px-4 py-5 sm:px-6">
      <header>
        <h2 className="font-serif text-[17px] tracking-tight">Term Sheet · Offer History</h2>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Formal offers and counter-offers negotiated in this deal room.
        </p>
      </header>

      {activeOfficerOffer && !roomClosed && (
        <div className="rounded-lg border border-gold/25 bg-gold/5 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold">
            Active term offer
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Alta has issued a term offer awaiting your response.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeOfficerOffer.canAccept && (
              <BankReviewButton
                label="Accept offer"
                variant="primary"
                onAction={async () => {
                  setError(null);
                  try {
                    await acceptOffer({ data: activeOfficerOffer.id });
                    await invalidate();
                  } catch (err) {
                    setError(parseError(err));
                  }
                }}
              />
            )}
            {activeOfficerOffer.canReject && (
              <RejectOfferButton
                onReject={async (note) => {
                  setError(null);
                  try {
                    await rejectOffer({
                      data: { offerId: activeOfficerOffer.id, rejectionNote: note },
                    });
                    setRejectNote("");
                    await invalidate();
                  } catch (err) {
                    setError(parseError(err));
                  }
                }}
                note={rejectNote}
                onNoteChange={setRejectNote}
              />
            )}
            {terms.canCreateCounterOffer && (
              <button
                type="button"
                onClick={() => setShowCounterForm((v) => !v)}
                className="rounded border border-border bg-surface-2 px-2 py-1 text-[11px] font-medium"
              >
                {showCounterForm ? "Cancel counter-offer" : "Submit counter-offer"}
              </button>
            )}
          </div>
        </div>
      )}

      {showCounterForm && terms.canCreateCounterOffer && (
        <CounterOfferForm
          dealRoomId={dealRoomId}
          defaults={activeOfficerOffer ?? terms}
          onSubmit={async (values) => {
            setError(null);
            try {
              await submitCounter({ data: values });
              setShowCounterForm(false);
              await invalidate();
            } catch (err) {
              setError(parseError(err));
            }
          }}
        />
      )}

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
          {error}
        </p>
      )}

      <DealOfferTimeline offers={offers} />
    </section>
  );
}

function RejectOfferButton({
  onReject,
  note,
  onNoteChange,
}: {
  onReject: (note: string) => Promise<void>;
  note: string;
  onNoteChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-destructive/40 bg-destructive/5 px-2 py-1 text-[11px] font-medium text-destructive"
      >
        Reject offer
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto">
      <input
        type="text"
        placeholder="Optional rejection note"
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        className={fieldClass}
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => void (async () => {
            setLoading(true);
            try {
              await onReject(note);
              setOpen(false);
            } finally {
              setLoading(false);
            }
          })()}
          className="rounded border border-destructive/40 bg-destructive/5 px-2 py-1 text-[11px] font-medium text-destructive disabled:opacity-50"
        >
          {loading ? "…" : "Confirm reject"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-border px-2 py-1 text-[11px]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function CounterOfferForm({
  dealRoomId,
  defaults,
  onSubmit,
}: {
  dealRoomId: string;
  defaults: DealRoomOfferRow | DealRoomTermsContext;
  onSubmit: (values: {
    dealRoomId: string;
    proposedPrincipal: number;
    proposedInterestRate: number;
    proposedTermMonths: number;
    proposedMinimumPayment?: number;
    proposedPaymentFrequency?: string;
    collateralDescription?: string;
    specialConditions?: string;
  }) => Promise<void>;
}) {
  const principal =
    "proposedPrincipal" in defaults
      ? defaults.proposedPrincipal
      : defaults.currentProposedAmount ?? defaults.requestedAmount;
  const rate =
    "proposedInterestRate" in defaults
      ? defaults.proposedInterestRate
      : defaults.currentProposedRate ?? 0;
  const term =
    "proposedTermMonths" in defaults
      ? defaults.proposedTermMonths
      : defaults.currentProposedTermMonths ?? defaults.requestedTermMonths;

  const [amount, setAmount] = useState(String(principal));
  const [ratePct, setRatePct] = useState(String(rate));
  const [termMonths, setTermMonths] = useState(String(term));
  const [minPayment, setMinPayment] = useState("");
  const [paymentFreq, setPaymentFreq] = useState("");
  const [collateral, setCollateral] = useState(
    "collateralDescription" in defaults ? defaults.collateralDescription ?? "" : "",
  );
  const [conditions, setConditions] = useState(
    "specialConditions" in defaults ? defaults.specialConditions ?? "" : "",
  );
  const [pending, setPending] = useState(false);

  return (
    <form
      className="rounded-lg border border-border bg-surface-2/20 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setPending(true);
        void onSubmit({
          dealRoomId,
          proposedPrincipal: Number(amount),
          proposedInterestRate: Number(ratePct),
          proposedTermMonths: Number(termMonths),
          proposedMinimumPayment: minPayment ? Number(minPayment) : undefined,
          proposedPaymentFrequency: paymentFreq.trim() || undefined,
          collateralDescription: collateral.trim() || undefined,
          specialConditions: conditions.trim() || undefined,
        }).finally(() => setPending(false));
      }}
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Counter-offer · Term sheet
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Proposed amount (ƒ)">
          <input
            type="number"
            min={1}
            step="1"
            required
            className={fieldClass}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
        <Field label="Monthly interest rate (%)">
          <input
            type="number"
            min={0}
            step="0.01"
            required
            className={fieldClass}
            value={ratePct}
            onChange={(e) => setRatePct(e.target.value)}
          />
        </Field>
        <Field label="Term (months)">
          <input
            type="number"
            min={1}
            max={MAX_DEAL_ROOM_TERM_MONTHS}
            required
            className={fieldClass}
            value={termMonths}
            onChange={(e) => setTermMonths(e.target.value)}
          />
        </Field>
        <Field label="Minimum payment (optional)">
          <input
            type="number"
            min={0}
            step="0.01"
            className={fieldClass}
            value={minPayment}
            onChange={(e) => setMinPayment(e.target.value)}
          />
        </Field>
        <Field label="Repayment notes (optional)" className="sm:col-span-2">
          <input
            type="text"
            className={fieldClass}
            value={paymentFreq}
            onChange={(e) => setPaymentFreq(e.target.value)}
            placeholder="e.g. Monthly equal principal"
          />
        </Field>
        <Field label="Collateral notes (optional)" className="sm:col-span-2">
          <textarea
            rows={2}
            className={cn(fieldClass, "resize-none")}
            value={collateral}
            onChange={(e) => setCollateral(e.target.value)}
          />
        </Field>
        <Field label="Special conditions (optional)" className="sm:col-span-2">
          <textarea
            rows={2}
            className={cn(fieldClass, "resize-none")}
            value={conditions}
            onChange={(e) => setConditions(e.target.value)}
          />
        </Field>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-md border border-gold/40 bg-gold/10 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-gold disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Submit counter-offer"}
      </button>
    </form>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}

function parseError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Action failed";
  if (message.startsWith("BAD_REQUEST:")) return message.slice("BAD_REQUEST:".length);
  if (message === "FORBIDDEN") return "You do not have permission for this action.";
  return message;
}
