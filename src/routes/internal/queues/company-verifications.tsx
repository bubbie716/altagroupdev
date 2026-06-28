import { createFileRoute } from "@tanstack/react-router";
import { CompanyVerificationsQueueView } from "@/components/internal/queues";
import { fetchInternalCompaniesFromDb } from "@/lib/company/company.functions";
import type { InternalCompanyRow } from "@/lib/company/types";

export const Route = createFileRoute("/internal/queues/company-verifications")({
  loader: async () => {
    try {
      return await fetchInternalCompaniesFromDb();
    } catch {
      const { getCompanyAccounts } = await import("@/lib/internal/api");
      return getCompanyAccounts().map(
        (c) =>
          ({
            id: c.id,
            name: c.name,
            ticker: c.ticker,
            type: c.type,
            sector: c.sector,
            status: c.status,
            verificationStatus: c.verificationStatus,
            representativeCount: c.representativeCount,
            primaryContact: c.primaryContact,
            lastUpdated: c.lastUpdated,
          }) satisfies InternalCompanyRow,
      );
    }
  },
  head: () => ({ meta: [{ title: "Company Verifications Queue — Alta Internal" }] }),
  component: CompanyVerificationsQueuePage,
});

function CompanyVerificationsQueuePage() {
  const companies = Route.useLoaderData();
  return <CompanyVerificationsQueueView companies={companies} />;
}
