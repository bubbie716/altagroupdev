import { createFileRoute } from "@tanstack/react-router";
import { cronResponse, validateCronSecret } from "@/lib/cron/cron-http";
import { accrueInterestForDueLoans } from "@/server/loan.service";

export const Route = createFileRoute("/api/cron/loan-interest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!validateCronSecret(request)) {
          return cronResponse({ ok: false, message: "Unauthorized." }, 401);
        }
        try {
          const interest = await accrueInterestForDueLoans();
          const { executeDueLoanAutoPayments } = await import("@/server/loan.service");
          const autoPay = await executeDueLoanAutoPayments();
          return cronResponse({ ok: true, ...interest, autoPay });
        } catch {
          return cronResponse({ ok: false, message: "Loan servicing failed." }, 500);
        }
      },
      POST: async ({ request }) => {
        if (!validateCronSecret(request)) {
          return cronResponse({ ok: false, message: "Unauthorized." }, 401);
        }
        try {
          const interest = await accrueInterestForDueLoans();
          const { executeDueLoanAutoPayments } = await import("@/server/loan.service");
          const autoPay = await executeDueLoanAutoPayments();
          return cronResponse({ ok: true, ...interest, autoPay });
        } catch {
          return cronResponse({ ok: false, message: "Loan servicing failed." }, 500);
        }
      },
    },
  },
});
