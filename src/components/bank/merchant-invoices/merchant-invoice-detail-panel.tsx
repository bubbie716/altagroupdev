"use client";

import { useState } from "react";
import { SUBMITTING_COPY } from "@/lib/ui/route-loading";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/page-shell";
import { florin } from "@/lib/bank/api";
import type { MerchantInvoiceDetail } from "@/lib/bank/merchant-invoice-types";
import { MERCHANT_INVOICE_EVENT_LABELS } from "@/lib/bank/merchant-invoice-types";
import {
  cancelMerchantInvoiceRecord,
  remindMerchantInvoiceRecord,
  sendMerchantInvoiceRecord,
} from "@/lib/bank/merchant-invoice.functions";
import { MerchantInvoiceStatusBadge } from "@/components/bank/merchant-invoices/merchant-invoice-status-badge";
import { canManageMerchantInvoices } from "@/lib/auth/permissions";
import type { AltaUser } from "@/lib/auth/types";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";
import {
  BankRequestActionButton,
  BankRequestErrorCard,
} from "@/components/bank/bank-request-submission-ui";
import { accountCommercialRoutes } from "@/lib/bank/account-commercial-path";

export function MerchantInvoiceDetailPanel({
  invoice,
  companyId,
  accountId,
  user,
}: {
  invoice: MerchantInvoiceDetail;
  companyId: string;
  accountId: string;
  user: AltaUser;
}) {
  const router = useRouter();
  const cancelInvoice = useServerFn(cancelMerchantInvoiceRecord);
  const remindInvoice = useServerFn(remindMerchantInvoiceRecord);
  const sendInvoice = useServerFn(sendMerchantInvoiceRecord);
  const [loading, setLoading] = useState<"cancel" | "remind" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManage = canManageMerchantInvoices(user, { companyId });

  async function handleCancel() {
    setLoading("cancel");
    setError(null);
    try {
      await cancelInvoice({ data: { companyId, invoiceId: invoice.id } });
      if (invoice.status === "DRAFT") {
        await router.navigate({
          to: accountCommercialRoutes.invoices,
          params: { accountId },
        });
        return;
      }
      await router.invalidate();
    } catch (err) {
      setError(formatCustomerActionError(err));
    } finally {
      setLoading(null);
    }
  }

  async function handleRemind() {
    setLoading("remind");
    setError(null);
    try {
      await remindInvoice({ data: { companyId, invoiceId: invoice.id } });
      await router.invalidate();
    } catch (err) {
      setError(formatCustomerActionError(err));
    } finally {
      setLoading(null);
    }
  }

  async function handleSend() {
    setLoading("send");
    setError(null);
    try {
      await sendInvoice({ data: { companyId, invoiceId: invoice.id } });
      await router.invalidate();
    } catch (err) {
      setError(formatCustomerActionError(err));
    } finally {
      setLoading(null);
    }
  }

  const isDraft = invoice.status === "DRAFT";
  const unpaid = ["SENT", "VIEWED", "OVERDUE", "PARTIALLY_PAID"].includes(invoice.status);

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="type-meta text-muted-foreground">{invoice.referenceCode}</p>
            <h1 className="text-xl font-semibold">{florin(invoice.amount)}</h1>
            <p className="mt-1 text-sm text-muted-foreground">To {invoice.recipientName}</p>
          </div>
          <MerchantInvoiceStatusBadge status={invoice.status} />
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Description</dt>
            <dd>{invoice.description}</dd>
          </div>
          {invoice.dueDate ? (
            <div>
              <dt className="text-muted-foreground">Due date</dt>
              <dd>{new Date(invoice.dueDate).toLocaleDateString()}</dd>
            </div>
          ) : null}
          {invoice.paymentReferenceCode ? (
            <div>
              <dt className="text-muted-foreground">Payment reference</dt>
              <dd>{invoice.paymentReferenceCode}</dd>
            </div>
          ) : null}
          {invoice.memo ? (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Internal memo</dt>
              <dd>{invoice.memo}</dd>
            </div>
          ) : null}
        </dl>

        {canManage && isDraft ? (
          <div className="flex flex-wrap gap-3 border-t border-border pt-4">
            <BankRequestActionButton
              submitting={loading === "send"}
              submittingLabel={SUBMITTING_COPY.sendingInvoice}
              onClick={() => void handleSend()}
            >
              Send invoice
            </BankRequestActionButton>
            <Link
              to={accountCommercialRoutes.invoiceEdit}
              params={{ accountId, invoiceId: invoice.id }}
              className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-2/60"
            >
              Edit draft
            </Link>
            <button
              type="button"
              className="rounded-md border border-border px-4 py-2 text-sm"
              disabled={loading === "cancel"}
              onClick={() => void handleCancel()}
            >
              {loading === "cancel" ? SUBMITTING_COPY.deleting : "Delete draft"}
            </button>
          </div>
        ) : null}
        {canManage && unpaid ? (
          <div className="flex flex-wrap gap-3 border-t border-border pt-4">
            <BankRequestActionButton
              submitting={loading === "remind"}
              submittingLabel={SUBMITTING_COPY.sendingReminder}
              onClick={() => void handleRemind()}
            >
              Send reminder
            </BankRequestActionButton>
            <button
              type="button"
              className="rounded-md border border-border px-4 py-2 text-sm"
              disabled={loading === "cancel"}
              onClick={() => void handleCancel()}
            >
              {loading === "cancel" ? SUBMITTING_COPY.cancelling : "Cancel invoice"}
            </button>
          </div>
        ) : null}
        {error ? <BankRequestErrorCard message={error} /> : null}
      </Card>

      {invoice.events.length > 0 ? (
        <Card className="p-6">
          <h2 className="text-sm font-medium">Activity</h2>
          <ul className="mt-4 space-y-3">
            {invoice.events.map((event) => (
              <li key={event.id} className="text-sm">
                <span className="font-medium">
                  {MERCHANT_INVOICE_EVENT_LABELS[event.eventType] ??
                    event.eventType.replace(/_/g, " ")}
                </span>
                <span className="text-muted-foreground">
                  {" "}
                  · {new Date(event.createdAt).toLocaleString()} · {event.source}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
