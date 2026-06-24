import { createFileRoute } from "@tanstack/react-router";
import { BusinessPayrollCenter } from "@/components/bank/business-payroll-center";
import { fetchBusinessAccountContextForModule } from "@/lib/bank/business-account.functions";
import {
  fetchPayrollEmployees,
  fetchPayrollRuns,
} from "@/lib/bank/business-banking.functions";
import { Route as AccountRoute } from "./route";

export const Route = createFileRoute("/bank/account/$accountId/payroll")({
  loader: async ({ params }) => {
    const ctx = await fetchBusinessAccountContextForModule({
      data: { accountId: params.accountId, module: "payroll" },
    });
    const [employees, runs] = await Promise.all([
      fetchPayrollEmployees({ data: ctx.companyId }),
      fetchPayrollRuns({ data: ctx.companyId }),
    ]);
    return { employees, runs };
  },
  head: () => ({ meta: [{ title: "Payroll — Business Account" }] }),
  component: BusinessAccountPayrollPage,
});

function BusinessAccountPayrollPage() {
  const { businessContext } = AccountRoute.useLoaderData();
  const { employees, runs } = Route.useLoaderData();

  if (!businessContext) {
    return <p className="text-[13px] text-muted-foreground">Business account access required.</p>;
  }

  return (
    <BusinessPayrollCenter
      company={businessContext.treasury}
      employees={employees}
      runs={runs}
    />
  );
}
