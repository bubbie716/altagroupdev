import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { TransferPageHeader } from "@/components/bank/transfer-page-header";
import { BusinessFutureNotice } from "@/components/bank/business-future-notice";

export const Route = createFileRoute("/bank/transfers/interbank")({
  validateSearch: (search: Record<string, unknown>) => ({
    accountId: typeof search.accountId === "string" ? search.accountId : undefined,
  }),
  head: () => ({
    meta: [{ title: "Interbank Transfers — Alta Bank" }],
  }),
  component: BankInterbankTransfers,
});

function BankInterbankTransfers() {
  const { accountId } = Route.useSearch();

  return (
    <>
      <BankPageMeta
        eyebrow="Alta Bank · Transfers"
        title="Interbank"
        description="External institution wires and transfers to other financial institutions are not yet available."
      />
      <TransferPageHeader title="Interbank transfers" accountId={accountId} />
      <Section title="Coming soon">
        <BusinessFutureNotice variant="interbank" />
        <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
          Interbank wire transfers and external institution payments are under development. Intrabank
          transfers between your Alta Bank accounts are available now under Transfers → Intrabank.
        </p>
      </Section>
    </>
  );
}
