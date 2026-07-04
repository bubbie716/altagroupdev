"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy } from "lucide-react";
import { Card } from "@/components/page-shell";
import { florin } from "@/lib/bank/api";
import type { PaymentLinkDetail } from "@/lib/bank/payment-link-types";
import { PAYMENT_LINK_EVENT_LABELS } from "@/lib/bank/payment-link-types";
import {
  activatePaymentLinkRecord,
  cancelPaymentLinkRecord,
  pausePaymentLinkRecord,
} from "@/lib/bank/payment-link.functions";
import { PaymentLinkStatusBadge } from "@/components/bank/payment-links/payment-link-status-badge";
import { canManagePaymentLinks } from "@/lib/auth/permissions";
import type { AltaUser } from "@/lib/auth/types";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";
import {
  BankRequestActionButton,
  BankRequestErrorCard,
} from "@/components/bank/bank-request-submission-ui";

function fullCheckoutUrl(path: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}${path}`;
  }
  return path;
}

export function PaymentLinkDetailPanel({
  link,
  companyId,
  user,
}: {
  link: PaymentLinkDetail;
  companyId: string;
  user: AltaUser;
}) {
  const router = useRouter();
  const pauseLink = useServerFn(pausePaymentLinkRecord);
  const activateLink = useServerFn(activatePaymentLinkRecord);
  const cancelLink = useServerFn(cancelPaymentLinkRecord);
  const [loading, setLoading] = useState<"pause" | "activate" | "cancel" | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManage = canManagePaymentLinks(user, { companyId });

  const checkoutFullUrl = fullCheckoutUrl(link.checkoutUrl);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(checkoutFullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy link to clipboard.");
    }
  }

  async function runAction(
    action: "pause" | "activate" | "cancel",
    fn: () => Promise<unknown>,
  ) {
    setLoading(action);
    setError(null);
    try {
      await fn();
      await router.invalidate();
    } catch (err) {
      setError(formatCustomerActionError(err));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="type-meta text-muted-foreground">{link.referenceCode}</p>
            <h1 className="text-xl font-semibold">
              {link.title?.trim() || link.description}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{link.description}</p>
          </div>
          <PaymentLinkStatusBadge status={link.status} />
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Amount</dt>
            <dd>
              {link.amountType === "FIXED" && link.amount != null
                ? florin(link.amount)
                : "Customer chooses amount"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Link type</dt>
            <dd>{link.usageType === "ONE_TIME" ? "One-time" : "Reusable"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Collected</dt>
            <dd>
              {florin(link.totalCollected)} · {link.paymentCount} payment
              {link.paymentCount === 1 ? "" : "s"}
            </dd>
          </div>
          {link.expiresAt ? (
            <div>
              <dt className="text-muted-foreground">Expires</dt>
              <dd>{new Date(link.expiresAt).toLocaleString()}</dd>
            </div>
          ) : null}
          {link.internalMemo ? (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Internal memo</dt>
              <dd>{link.internalMemo}</dd>
            </div>
          ) : null}
        </dl>

        <div className="rounded-md border border-border bg-surface-2/40 p-4">
          <p className="type-meta text-muted-foreground">Checkout link</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 break-all text-[13px]">{checkoutFullUrl}</code>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[13px] font-medium hover:bg-surface-2/60"
            >
              {copied ? <Check className="size-4 text-[var(--success)]" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          <p className="mt-2 text-[12px] text-muted-foreground">
            Share this link in Discord, email, or anywhere customers can open Alta Bank.
          </p>
        </div>

        {canManage ? (
          <div className="flex flex-wrap gap-3 border-t border-border pt-4">
            {link.status === "ACTIVE" ? (
              <BankRequestActionButton
                submitting={loading === "pause"}
                submittingLabel="Pausing…"
                onClick={() =>
                  void runAction("pause", () =>
                    pauseLink({ data: { companyId, linkId: link.id } }),
                  )
                }
              >
                Pause link
              </BankRequestActionButton>
            ) : null}
            {link.status === "PAUSED" ? (
              <BankRequestActionButton
                submitting={loading === "activate"}
                submittingLabel="Activating…"
                onClick={() =>
                  void runAction("activate", () =>
                    activateLink({ data: { companyId, linkId: link.id } }),
                  )
                }
              >
                Activate link
              </BankRequestActionButton>
            ) : null}
            {["ACTIVE", "PAUSED"].includes(link.status) ? (
              <button
                type="button"
                className="rounded-md border border-border px-4 py-2 text-sm"
                disabled={loading === "cancel"}
                onClick={() =>
                  void runAction("cancel", () =>
                    cancelLink({ data: { companyId, linkId: link.id } }),
                  )
                }
              >
                {loading === "cancel" ? "Cancelling…" : "Cancel link"}
              </button>
            ) : null}
          </div>
        ) : null}
        {error ? <BankRequestErrorCard message={error} /> : null}
      </Card>

      {link.recentPayments.length > 0 ? (
        <Card className="p-6">
          <h2 className="text-sm font-medium">Recent payments</h2>
          <ul className="mt-4 space-y-3">
            {link.recentPayments.map((payment) => (
              <li key={payment.id} className="flex justify-between gap-4 text-sm">
                <span>
                  {payment.payerLabel ?? "Customer"} · {payment.paymentReferenceCode ?? "Pending"}
                </span>
                <span className="type-finance-nums">{florin(payment.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {link.events.length > 0 ? (
        <Card className="p-6">
          <h2 className="text-sm font-medium">Activity</h2>
          <ul className="mt-4 space-y-3">
            {link.events.map((event) => (
              <li key={event.id} className="text-sm">
                <span className="font-medium">
                  {PAYMENT_LINK_EVENT_LABELS[event.eventType] ??
                    event.eventType.replace(/_/g, " ")}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  · {new Date(event.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
