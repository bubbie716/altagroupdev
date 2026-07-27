"use client";

import { useRouter } from "@tanstack/react-router";
import { PaymentLinkWorkflow } from "@/components/bank/payment-links/payment-link-workflow";
import { accountCommercialRoutes } from "@/lib/bank/account-commercial-path";

/**
 * Page-friendly wrapper around {@link PaymentLinkWorkflow}.
 * Prefer launching create from the dashboard modal; `/new` redirects with `?create=1`.
 */
export function PaymentLinkForm({
  companyId,
  accountId,
}: {
  companyId: string;
  accountId: string;
}) {
  const router = useRouter();

  function leave() {
    void router.navigate({
      to: accountCommercialRoutes.paymentLinks,
      params: { accountId },
    });
  }

  return (
    <PaymentLinkWorkflow
      open
      onOpenChange={(open) => {
        if (!open) leave();
      }}
      onDone={leave}
      companyId={companyId}
      accountId={accountId}
    />
  );
}
