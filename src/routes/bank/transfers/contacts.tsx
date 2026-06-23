import { createFileRoute, useRouter } from "@tanstack/react-router";
import { PageShell, Section, Card } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { TransferPageHeader } from "@/components/bank/transfer-page-header";
import { BankTransferContactsManager } from "@/components/bank/bank-transfer-contacts-manager";
import { fetchActiveBankAccounts, fetchAllTransferContacts } from "@/lib/bank/bank.functions";
import { isUserFinancialMockDataEnabled } from "@/lib/config/data-mode";

export const Route = createFileRoute("/bank/transfers/contacts")({
  loader: async () => {
    if (isUserFinancialMockDataEnabled()) return null;
    const [accounts, contacts] = await Promise.all([
      fetchActiveBankAccounts(),
      fetchAllTransferContacts(),
    ]);
    return { accounts, contacts };
  },
  head: () => ({
    meta: [{ title: "Transfer Contacts — Alta Bank" }],
  }),
  component: BankTransferContactsPage,
});

function BankTransferContactsPage() {
  const showMockData = isUserFinancialMockDataEnabled();
  const data = Route.useLoaderData();
  const router = useRouter();

  return (
    <PageShell
      eyebrow="Alta Bank · Transfers"
      title="Contacts"
      description="Saved recipients for intrabank transfers and future interbank wires."
    >
      <BankSubNav />
      <TransferPageHeader />

      {showMockData ? (
        <Card className="!p-6">
          <p className="text-[13px] text-muted-foreground">
            Transfer contacts are available when connected to live Alta Bank accounts.
          </p>
        </Card>
      ) : !data ? (
        <Card className="!p-6">
          <p className="text-[13px] text-muted-foreground">Unable to load contacts.</p>
        </Card>
      ) : (
        <div className="grid gap-10 lg:grid-cols-2">
          <Section title="Intrabank contacts">
            <Card className="!p-6">
              <p className="mb-4 text-[13px] text-muted-foreground">
                Shortcuts for other Alta Bank clients by account number.
              </p>
              {data.accounts.length === 0 && (
                <p className="mb-4 text-[13px] text-muted-foreground">
                  Open an Alta Bank account to send intrabank transfers.
                </p>
              )}
              <BankTransferContactsManager
                scope="intrabank"
                contacts={data.contacts}
                onChanged={() => void router.invalidate()}
              />
            </Card>
          </Section>

          <Section title="Interbank contacts">
            <Card className="!p-6">
              <p className="mb-4 text-[13px] text-muted-foreground">
                External wire recipients — ready for when NCC-Net wires launch.
              </p>
              <BankTransferContactsManager
                scope="interbank"
                contacts={data.contacts}
                onChanged={() => void router.invalidate()}
              />
            </Card>
          </Section>
        </div>
      )}
    </PageShell>
  );
}
