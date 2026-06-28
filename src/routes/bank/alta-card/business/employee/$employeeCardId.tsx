import { createFileRoute, Link } from "@tanstack/react-router";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { AltaCardEmployeeCardPanel } from "@/components/bank/alta-card/alta-card-employee-card-panel";
import { authBeforeLoad } from "@/lib/auth/guards";
import { fetchUserEmployeeAltaCardDetail } from "@/lib/bank/alta-card.functions";

export const Route = createFileRoute("/bank/alta-card/business/employee/$employeeCardId")({
  beforeLoad: authBeforeLoad,
  loader: async ({ params }) => fetchUserEmployeeAltaCardDetail({ data: params.employeeCardId }),
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.companyName ?? "Employee"} Card — Alta Bank` }],
  }),
  component: EmployeeAltaCardDetailPage,
});

function EmployeeAltaCardDetailPage() {
  const card = Route.useLoaderData();

  return (
    <>
      <BankPageMeta
      eyebrow="Alta Bank · Alta Card"
      title={`${card.companyName} employee card`}
      description="Authorized spending against your company's business credit line."
      action={
        <Link
          to="/bank/alta-card/business"
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
        >
          ← Business cards
        </Link>
      }
    />
<AltaCardEmployeeCardPanel card={card} />
    </>
  );
}
