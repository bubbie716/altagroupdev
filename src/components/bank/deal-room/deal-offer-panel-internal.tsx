import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BankReviewButton } from "@/components/bank/bank-review-button";
import { DealOfferTimeline } from "@/components/bank/deal-room/deal-offer-timeline";
import {
  acceptDealRoomOfferRecord,
  rejectDealRoomOfferRecord,
  submitOfficerOffer,
  updateDealRoomStatusRecord,
  withdrawDealRoomOfferRecord,
} from "@/lib/bank/deal-room.functions";
import type { DealRoomOfferRow, DealRoomTermsContext } from "@/lib/bank/deal-room-types";
import { MAX_DEAL_ROOM_TERM_MONTHS } from "@/lib/bank/deal-room-types";
import { cn } from "@/lib/utils";

const fieldClass =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-[13px]";
const labelClass = "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground";

export function DealOfferPanelInternal({
  dealRoomId,
  offers,
  terms,
  roomClosed = false,
}: {
  dealRoomId: string;
  offers: DealRoomOfferRow[];
  terms: DealRoomTermsContext;
  roomClosed?: boolean;
}) {
  const router = useRouter();
  const sendOffer = useServerFn(submitOfficerOffer);
  const acceptOffer = useServerFn(acceptDealRoomOfferRecord);
  const rejectOffer = useServerFn(rejectDealRoomOfferRecord);
  const withdrawOffer = useServerFn(withdrawDealRoomOfferRecord);
  const updateStatus = useServerFn(updateDealRoomStatusRecord);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(terms.canCreateOfficerOffer);

  const activeCounter = offers.find(
    (o) => o.isActive && o.offerType === "applicant_counter",
  );
  const activeOfficerOffer = offers.find(
    (o) => o.isActive && o.offerType === "officer_offer",
  );

  async function invalidate() {
    await router.invalidate();
  }

  return (
    <section className="space-y-6 border-b border-border bg-surface-1/40 px-4 py-5 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-[17px] tracking-tight">Term Offer · Officer Controls</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Issue formal term offers and respond to applicant counter-offers.
          </p>
        </div>
        {terms.canCreateOfficerOffer && !roomClosed && (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-gold"
          >
            {showForm ? "Hide form" : "Create term offer"}
          </button>
        )}
      </header>

      {activeCounter && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-600 dark:text-amber-400">
            Active counter-offer
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeCounter.canAccept && (
              <BankReviewButton
                label="Accept counter-offer for review"
                variant="primary"
                onAction={async () => {
                  setError(null);
                  try {
                    await acceptOffer({ data: activeCounter.id });
                    await invalidate();
                  } catch (err) {
                    setError(parseError(err));
                  }
                }}
              />
            )}
            {activeCounter.canReject && (
              <BankReviewButton
                label="Reject counter-offer"
                variant="danger"
                onAction={async () => {
                  setError(null);
                  try {
                    await rejectOffer({ data: { offerId: activeCounter.id } });
                    await invalidate();
                  } catch (err) {
                    setError(parseError(err));
                  }
                }}
              />
            )}
          </div>
        </div>
      )}

      {activeOfficerOffer && (
        <div className="flex flex-wrap gap-2">
          {activeOfficerOffer.canWithdraw && (
            <BankReviewButton
              label="Withdraw offer"
              variant="default"
              onAction={async () => {
                setError(null);
                try {
                  await withdrawOffer({ data: activeOfficerOffer.id });
                  await invalidate();
                } catch (err) {
                  setError(parseError(err));
                }
              }}
            />
          )}
        </div>
      )}

      {terms.acceptedTerms && (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">
            Accepted terms on file
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Principal ƒ{terms.acceptedTerms.principal.toLocaleString()} ·{" "}
            {terms.acceptedTerms.interestRate}% monthly · {terms.acceptedTerms.termMonths} mo
          </p>
          <div className="mt-2">
            <BankReviewButton
              label="Mark ready for contract"
              variant="primary"
              onAction={async () => {
                await updateStatus({
                  data: { dealRoomId, status: "READY_FOR_ACCEPTANCE" },
                });
                await invalidate();
              }}
            />
          </div>
        </div>
      )}

      {showForm && terms.canCreateOfficerOffer && (
        <OfficerOfferForm
          dealRoomId={dealRoomId}
          defaults={terms}
          onSubmit={async (values) => {
            setError(null);
            try {
              await sendOffer({ data: values });
              setShowForm(false);
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

      <div>
        <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Offer history
        </h3>
        <DealOfferTimeline offers={offers} />
      </div>
    </section>
  );
}

function OfficerOfferForm({
  dealRoomId,
  defaults,
  onSubmit,
}: {
  dealRoomId: string;
  defaults: DealRoomTermsContext;
  onSubmit: (values: {
    dealRoomId: string;
    proposedPrincipal: number;
    proposedInterestRate: number;
    proposedTermMonths: number;
    proposedMinimumPayment?: number;
    proposedPaymentFrequency?: string;
    collateralDescription?: string;
    specialConditions?: string;
    expiresAt?: string;
  }) => Promise<void>;
}) {
  const [amount, setAmount] = useState(
    String(defaults.currentProposedAmount ?? defaults.requestedAmount),
  );
  const [ratePct, setRatePct] = useState(String(defaults.currentProposedRate ?? 0));
  const [termMonths, setTermMonths] = useState(
    String(defaults.currentProposedTermMonths ?? defaults.requestedTermMonths),
  );
  const [minPayment, setMinPayment] = useState("");
  const [paymentFreq, setPaymentFreq] = useState(defaults.requestedPaymentStructure ?? "");
  const [collateral, setCollateral] = useState("");
  const [conditions, setConditions] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
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
          expiresAt: expiresAt || undefined,
        }).finally(() => setPending(false));
      }}
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        Create term offer
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Approved principal (ƒ)">
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
        <Field label="Minimum payment">
          <input
            type="number"
            min={0}
            step="0.01"
            className={fieldClass}
            value={minPayment}
            onChange={(e) => setMinPayment(e.target.value)}
          />
        </Field>
        <Field label="Payment frequency">
          <input
            type="text"
            className={fieldClass}
            value={paymentFreq}
            onChange={(e) => setPaymentFreq(e.target.value)}
            placeholder="Monthly"
          />
        </Field>
        <Field label="Expiration date (optional)">
          <input
            type="date"
            className={fieldClass}
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </Field>
        <Field label="Collateral description" className="sm:col-span-2">
          <textarea
            rows={2}
            className={cn(fieldClass, "resize-none")}
            value={collateral}
            onChange={(e) => setCollateral(e.target.value)}
          />
        </Field>
        <Field label="Special conditions" className="sm:col-span-2">
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
        {pending ? "Sending…" : "Send offer"}
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
