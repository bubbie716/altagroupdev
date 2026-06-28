import { redirect } from "@tanstack/react-router";
import { isCreditDeskApplicationPath } from "@/lib/platform/credit-desk-guard";
import { fetchCreditDeskClosedGate } from "@/lib/platform/platform-settings.functions";

type CreditDeskGuardContext = {
  location: { pathname: string };
};

/** Redirects customers away from new-application routes when the Credit Desk is closed. */
export async function creditDeskApplicationBeforeLoad(context: CreditDeskGuardContext): Promise<void> {
  if (!isCreditDeskApplicationPath(context.location.pathname)) return;

  const closed = await fetchCreditDeskClosedGate();
  if (closed) {
    throw redirect({ to: "/bank/credit-desk-closed" });
  }
}
