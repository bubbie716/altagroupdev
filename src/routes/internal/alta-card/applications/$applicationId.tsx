import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { BankReviewButton } from "@/components/bank/bank-review-button";
import { AltaCardApplicationThreadView } from "@/components/bank/alta-card/alta-card-application-thread-view";
import {
  ALTA_CARD_APPLICATION_STATUS_LABELS,
} from "@/lib/bank/alta-card-application-thread-types";
import {
  ALTA_CARD_TIER_LABELS,
  formatAltaCardCurrency,
  formatAltaCardRate,
} from "@/lib/bank/alta-card-types";
import {
  approveAltaCardApplicationRecord,
  denyAltaCardApplicationRecord,
} from "@/lib/bank/alta-card.functions";
import {
  fetchInternalAltaCardApplicationDetail,
  updateAltaCardApplicationStatusRecord,
} from "@/lib/bank/alta-card-application.functions";
import { useState } from "react";
import { isAdmin } from "@/lib/auth/permissions";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/internal/alta-card/applications/$applicationId")({
  loader: async ({ params }) => {
    const review = await fetchInternalAltaCardApplicationDetail({ data: params.applicationId });
    return {
      review,
      threadContext: review.threadContext,
      messages: review.messages,
    };
  },
  head: () => ({ meta: [{ title: "Alta Card Application Review — Alta Internal" }] }),
  component: InternalAltaCardApplicationDetail,
});

function InternalAltaCardApplicationDetail() {
  const { review, threadContext, messages } = Route.useLoaderData();
  const router = useRouter();
  const user = useCurrentUser();
  const admin = user ? isAdmin(user) : false;
  const app = review.application;
  const rel = review.relationship;

  const [tier, setTier] = useState(app.approvedTier ?? app.requestedTier);
  const [limit, setLimit] = useState(String(app.approvedLimit ?? app.requestedLimit ?? 5000));
  const [rate, setRate] = useState(String(app.approvedInterestRate ?? 19.99));
  const [billingDay, setBillingDay] = useState(String(app.billingCycleDay ?? 1));
  const [notes, setNotes] = useState(app.reviewNote ?? "");
  const [denialReason, setDenialReason] = useState("");
  const [goldOverride, setGoldOverride] = useState(false);
  const [activateNow, setActivateNow] = useState(false);

  const open = ["submitted", "under_review", "needs_info"].includes(app.status);

  return (
    <InternalPageShell title="Application review" description="Alta Card underwriting and thread.">
      <Link
        to="/internal/alta-card/applications"
        className="mb-6 inline-block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
      >
        ← Applications queue
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-surface-1/80 p-5">
            <h3 className="font-serif text-[18px]">{app.applicantUsername}</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {app.cardType} · {ALTA_CARD_TIER_LABELS[app.requestedTier]} ·{" "}
              {ALTA_CARD_APPLICATION_STATUS_LABELS[app.status]}
            </p>
            {app.companyName ? (
              <p className="mt-1 text-[13px]">Company: {app.companyName}</p>
            ) : null}
            {app.purpose ? <p className="mt-3 text-[13px]">{app.purpose}</p> : null}
          </section>

          <section className="rounded-xl border border-gold/30 bg-gold/5 p-5">
            <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Relationship recommendation
            </h4>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Score {rel.relationshipScore}/100 — recommendation only, not auto-approval
            </p>
            <dl className="mt-3 grid gap-2 sm:grid-cols-3 text-[13px]">
              <div>
                <dt className="text-muted-foreground">Tier</dt>
                <dd>{ALTA_CARD_TIER_LABELS[rel.recommendedTier]}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Limit</dt>
                <dd className="font-mono">{formatAltaCardCurrency(rel.recommendedCreditLimit)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Rate</dt>
                <dd className="font-mono">{formatAltaCardRate(rel.recommendedInterestRate)}</dd>
              </div>
            </dl>
            <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-[12px]">
              {rel.relationshipFactors.map((f) => (
                <li key={f.key}>
                  {f.label}: {f.value}{" "}
                  <span className="text-muted-foreground">
                    ({f.impact >= 0 ? "+" : ""}
                    {f.impact})
                  </span>
                </li>
              ))}
            </ul>
            {open ? (
              <BankReviewButton
                label="Apply recommendation"
                variant="primary"
                onAction={async () => {
                  setTier(rel.recommendedTier);
                  setLimit(String(rel.recommendedCreditLimit));
                  setRate(String(rel.recommendedInterestRate));
                }}
              />
            ) : null}
          </section>

          <section className="rounded-xl border border-border bg-surface-1/80 p-5">
            <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Terms comparison
            </h4>
            <dl className="mt-3 space-y-2 text-[13px]">
              <div className="flex justify-between gap-4">
                <span>Requested</span>
                <span>
                  {ALTA_CARD_TIER_LABELS[app.requestedTier]} ·{" "}
                  {formatAltaCardCurrency(app.requestedLimit ?? 0)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Recommended</span>
                <span>
                  {ALTA_CARD_TIER_LABELS[rel.recommendedTier]} ·{" "}
                  {formatAltaCardCurrency(rel.recommendedCreditLimit)} ·{" "}
                  {formatAltaCardRate(rel.recommendedInterestRate)}
                </span>
              </div>
              <div className="flex justify-between gap-4 font-medium">
                <span>Approved (form)</span>
                <span>
                  {ALTA_CARD_TIER_LABELS[tier]} · {formatAltaCardCurrency(Number(limit))} ·{" "}
                  {formatAltaCardRate(Number(rate))}
                </span>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-border bg-surface-1/80 p-5">
            <h4 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Relationship summary
            </h4>
            <ul className="mt-3 space-y-1 text-[13px]">
              <li>Applicant accounts: {review.applicantAccountCount}</li>
              <li>Applicant loans: {review.applicantLoanCount}</li>
              {review.companyAccountCount != null ? (
                <li>Company accounts: {review.companyAccountCount}</li>
              ) : null}
              {review.companyLoanCount != null ? (
                <li>Company loans: {review.companyLoanCount}</li>
              ) : null}
              <li className="text-muted-foreground">Alta Pay volume: —</li>
            </ul>
          </section>

          {open ? (
            <section className="space-y-3 rounded-xl border border-border bg-surface-1/80 p-5">
              <h4 className="font-serif text-[16px]">Actions</h4>
              <div className="flex flex-wrap gap-2">
                <BankReviewButton
                  label="Under review"
                  onAction={async () => {
                    await updateAltaCardApplicationStatusRecord({
                      data: { applicationId: app.id, status: "under_review" },
                    });
                    await router.invalidate();
                  }}
                />
                <BankReviewButton
                  label="Request info"
                  onAction={async () => {
                    await updateAltaCardApplicationStatusRecord({
                      data: { applicationId: app.id, status: "needs_info" },
                    });
                    await router.invalidate();
                  }}
                />
              </div>

              <div className="grid gap-3 pt-2">
                <select
                  value={tier}
                  onChange={(e) => setTier(e.target.value as typeof tier)}
                  className="rounded border border-border bg-surface-1 px-2 py-1 text-[13px]"
                >
                  {Object.entries(ALTA_CARD_TIER_LABELS).map(([code, label]) => (
                    <option key={code} value={code}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  className="rounded border border-border px-2 py-1 font-mono text-[12px]"
                  placeholder="Approved limit"
                />
                <input
                  type="number"
                  step="0.01"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className="rounded border border-border px-2 py-1 font-mono text-[12px]"
                  placeholder="Interest rate %"
                />
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={billingDay}
                  onChange={(e) => setBillingDay(e.target.value)}
                  className="rounded border border-border px-2 py-1 font-mono text-[12px]"
                  placeholder="Billing cycle day"
                />
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Review notes"
                  className="rounded border border-border px-2 py-1 text-[13px]"
                  rows={2}
                />
                {tier === "gold" && admin ? (
                  <label className="flex items-center gap-2 text-[12px]">
                    <input
                      type="checkbox"
                      checked={goldOverride}
                      onChange={(e) => setGoldOverride(e.target.checked)}
                    />
                    Gold override (non–private client)
                  </label>
                ) : null}
                {admin ? (
                  <label className="flex items-center gap-2 text-[12px]">
                    <input
                      type="checkbox"
                      checked={activateNow}
                      onChange={(e) => setActivateNow(e.target.checked)}
                    />
                    Approve and activate immediately
                  </label>
                ) : null}
                <BankReviewButton
                  label="Approve"
                  variant="primary"
                  onAction={async () => {
                    await approveAltaCardApplicationRecord({
                      data: {
                        applicationId: app.id,
                        approvedLimit: Number(limit),
                        interestRate: Number(rate),
                        tier,
                        billingCycleDay: Number(billingDay),
                        reviewNote: notes || undefined,
                        goldOverride: goldOverride || undefined,
                        approveAndActivate: activateNow || undefined,
                      },
                    });
                    await router.invalidate();
                  }}
                />
                <textarea
                  value={denialReason}
                  onChange={(e) => setDenialReason(e.target.value)}
                  placeholder="Denial reason (required)"
                  className="rounded border border-border px-2 py-1 text-[13px]"
                  rows={2}
                />
                <BankReviewButton
                  label="Deny"
                  variant="danger"
                  onAction={async () => {
                    await denyAltaCardApplicationRecord({
                      data: { applicationId: app.id, denialReason },
                    });
                    await router.invalidate();
                  }}
                />
              </div>
            </section>
          ) : app.status === "approved" && app.approvedLimit ? (
            <section className="rounded-xl border border-border bg-surface-1/80 p-5 text-[13px]">
              <p>Approved: {formatAltaCardCurrency(app.approvedLimit)}</p>
              <p className="mt-1">
                {app.approvedTier ? ALTA_CARD_TIER_LABELS[app.approvedTier] : ""} ·{" "}
                {app.approvedInterestRate != null
                  ? formatAltaCardRate(app.approvedInterestRate)
                  : ""}
              </p>
            </section>
          ) : null}
        </div>

        <AltaCardApplicationThreadView
          context={threadContext}
          messages={messages}
          variant="internal"
        />
      </div>
    </InternalPageShell>
  );
}
