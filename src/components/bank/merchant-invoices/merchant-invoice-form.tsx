"use client";

import { useRouter } from "@tanstack/react-router";
import { MerchantInvoiceWorkflow } from "@/components/bank/merchant-invoices/merchant-invoice-workflow";
import type { MerchantInvoiceDetail } from "@/lib/bank/merchant-invoice-types";
import { accountCommercialRoutes } from "@/lib/bank/account-commercial-path";

/**
 * Page-friendly wrapper around {@link MerchantInvoiceWorkflow}.
 * Prefer launching create from the dashboard modal; edit/new routes still work.
 */
export function MerchantInvoiceForm({
  companyId,
  accountId,
  initialInvoice,
}: {
  companyId: string;
  accountId: string;
  initialInvoice?: MerchantInvoiceDetail;
}) {
  const router = useRouter();

  function leave() {
    if (initialInvoice) {
      void router.navigate({
        to: accountCommercialRoutes.invoiceDetail,
        params: { accountId, invoiceId: initialInvoice.id },
      });
      return;
    }
    void router.navigate({
      to: accountCommercialRoutes.invoices,
      params: { accountId },
    });
  }

  return (
    <MerchantInvoiceWorkflow
      open
      onOpenChange={(open) => {
        if (!open) leave();
      }}
      onDone={leave}
      companyId={companyId}
      accountId={accountId}
      initialInvoice={initialInvoice}
    />
  );
}
