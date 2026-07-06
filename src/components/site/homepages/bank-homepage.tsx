import { EntityFeatureGrid, EntityMarketingShell } from "@/components/site/entity-marketing-shell";
import { useSiteContext } from "@/hooks/use-site-context";

export function BankHomepage() {
  const site = useSiteContext();

  return (
    <EntityMarketingShell
      eyebrow={site.entityName}
      title="Banking, payments, and commercial finance for Newport."
      description="Open accounts, move money with Alta Pay, manage business treasury, issue Alta Card, and run commercial billing — one platform for individuals and companies."
    >
      <EntityFeatureGrid
        items={[
          {
            title: "Personal accounts",
            description: "Deposit, withdraw, transfer, and manage everyday banking in Florins.",
            to: "/bank/open",
          },
          {
            title: "Business banking",
            description: "Operating accounts, payroll, treasury, and company financial controls.",
            to: "/bank/business",
          },
          {
            title: "Alta Pay",
            description: "Send and receive payments between Alta customers and businesses.",
            to: "/bank/pay",
          },
          {
            title: "Alta Card",
            description: "Personal and business card programs with statements and controls.",
            to: "/bank/alta-card",
          },
          {
            title: "Commercial",
            description: "Invoices, payment links, autopay, and merchant services.",
            to: "/bank/commercial",
          },
          {
            title: "Alta Private",
            description: "Private banking services for qualified clients.",
            to: "/bank/private",
          },
        ]}
      />
    </EntityMarketingShell>
  );
}
