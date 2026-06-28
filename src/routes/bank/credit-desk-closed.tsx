import { createFileRoute } from "@tanstack/react-router";
import { CreditDeskClosedPage } from "@/components/bank/credit-desk-closed-page";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/bank/credit-desk-closed")({
  beforeLoad: authBeforeLoad,
  head: () => ({ meta: [{ title: "Credit Desk Closed — Alta Bank" }] }),
  component: CreditDeskClosedPage,
});
