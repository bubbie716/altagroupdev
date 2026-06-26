import { Link } from "@tanstack/react-router";
import type { AltaCardApplicationDetail } from "@/lib/bank/alta-card-types";
import {
  ALTA_CARD_TIER_LABELS,
  formatAltaCardCurrency,
  formatAltaCardRate,
} from "@/lib/bank/alta-card-types";
import { ALTA_CARD_APPLICATION_STATUS_LABELS } from "@/lib/bank/alta-card-application-thread-types";
import { BankReviewButton } from "@/components/bank/bank-review-button";
import { AltaCardApplicationThreadView } from "@/components/bank/alta-card/alta-card-application-thread-view";
import { acceptAltaCardApplicationRecord } from "@/lib/bank/alta-card-application.functions";
import type {
  AltaCardApplicationThreadContext,
  AltaCardApplicationThreadMessageRow,
} from "@/lib/bank/alta-card-application-thread-types";

export function AltaCardApplicationDetailView({
  application,
  threadContext,
  messages,
  onAccepted,
}: {
  application: AltaCardApplicationDetail;
  threadContext: AltaCardApplicationThreadContext;
  messages: AltaCardApplicationThreadMessageRow[];
  onAccepted?: () => Promise<void>;
}) {
  const canAccept =
    application.status === "approved" && !application.acceptedAt && !application.cardId;

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-border bg-surface-1/80 p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold">Alta Card Application</p>
        <h2 className="mt-2 font-serif text-[24px]">
          {application.cardType === "personal" ? "Personal" : "Business"} ·{" "}
          {ALTA_CARD_TIER_LABELS[application.requestedTier]}
        </h2>
        <p className="mt-2 text-[14px] text-muted-foreground">
          Status: {ALTA_CARD_APPLICATION_STATUS_LABELS[application.status] ?? application.status}
        </p>

        {["submitted", "under_review", "needs_info"].includes(application.status) ? (
          <div className="mt-5 rounded-lg border border-border bg-surface-2/50 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Next steps
            </p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-[13px] text-muted-foreground">
              <li>Our team reviews your Alta relationship and requested terms.</li>
              <li>Respond to any requests in your application thread below.</li>
              <li>When approved, accept your card to activate your credit line.</li>
            </ol>
          </div>
        ) : null}

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Requested limit
            </dt>
            <dd className="mt-1 font-mono tabular-nums">
              {application.requestedLimit != null
                ? formatAltaCardCurrency(application.requestedLimit)
                : "—"}
            </dd>
          </div>
          {application.approvedLimit != null ? (
            <>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Approved tier
                </dt>
                <dd className="mt-1">
                  {application.approvedTier
                    ? ALTA_CARD_TIER_LABELS[application.approvedTier]
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Approved limit
                </dt>
                <dd className="mt-1 font-mono tabular-nums">
                  {formatAltaCardCurrency(application.approvedLimit)}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Approved rate
                </dt>
                <dd className="mt-1 font-mono tabular-nums">
                  {application.approvedInterestRate != null
                    ? formatAltaCardRate(application.approvedInterestRate)
                    : "—"}
                </dd>
              </div>
            </>
          ) : null}
        </dl>

        {application.denialReason ? (
          <p className="mt-4 text-[13px] text-destructive">{application.denialReason}</p>
        ) : null}

        {canAccept ? (
          <div className="mt-6">
            <BankReviewButton
              label="Accept card"
              variant="primary"
              onAction={async () => {
                await acceptAltaCardApplicationRecord({ data: application.id });
                await onAccepted?.();
              }}
            />
            <p className="mt-2 text-[12px] text-muted-foreground">
              Accepting activates your Alta Card with the approved terms.
            </p>
          </div>
        ) : null}

        {application.cardId ? (
          application.cardType === "business" && application.companyId ? (
            <Link
              to="/bank/alta-card/business/$companyId"
              params={{ companyId: application.companyId }}
              className="mt-4 inline-block font-mono text-[10px] uppercase tracking-[0.16em] text-gold"
            >
              View business card →
            </Link>
          ) : (
            <Link
              to="/bank/alta-card/$cardId"
              params={{ cardId: application.cardId }}
              className="mt-4 inline-block font-mono text-[10px] uppercase tracking-[0.16em] text-gold"
            >
              View your card →
            </Link>
          )
        ) : null}
      </div>

      <AltaCardApplicationThreadView
        context={threadContext}
        messages={messages}
        variant="user"
      />
    </div>
  );
}

export { AltaCardTierComparison } from "@/components/bank/alta-card/alta-card-tier-comparison";
