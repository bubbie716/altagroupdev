import { createFileRoute, redirect } from "@tanstack/react-router";
import { BusinessPayrollCenter } from "@/components/bank/business-payroll-center";
import { fetchBusinessAccountContextForModule } from "@/lib/bank/business-account.functions";
import {
  fetchPayrollEmployees,
  fetchPayrollRuns,
} from "@/lib/bank/business-banking.functions";

export const Route = createFileRoute("/bank/account/$accountId/commercial/payroll")({
  loader: async ({ params }) => {
    try {
      const ctx = await fetchBusinessAccountContextForModule({
        data: { accountId: params.accountId, module: "payroll" },
      });
      const [employees, runs] = await Promise.all([
        fetchPayrollEmployees({ data: ctx.companyId }),
        fetchPayrollRuns({ data: ctx.companyId }),
      ]);
      return { employees, runs, treasury: ctx.treasury };
    } catch {
      throw redirect({
        to: "/bank/account/$accountId/commercial/settings",
        params: { accountId: params.accountId },
      });
    }
  },
  head: () => ({ meta: [{ title: "Payroll — Alta Commercial" }] }),
  component: AccountCommercialPayrollPage,
});

function AccountCommercialPayrollPage() {
  const { employees, runs, treasury } = Route.useLoaderData();

  return (
    <BusinessPayrollCenter company={treasury} employees={employees} runs={runs} />
  );
}
