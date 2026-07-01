import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
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
    <>
      <BankPageMeta
      eyebrow="Alta Bank · Transfers"
      title="Contacts"
      description="Saved recipients for intrabank transfers and future interbank wires."
     />
<TransferPageHeader />

      {showMockData ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-1/40 px-6 py-10 text-center">
          <p className="text-[13px] text-muted-foreground">
            Transfer contacts are available when connected to live Alta Bank accounts.
          </p>
        </div>
      ) : !data ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-1/40 px-6 py-10 text-center">
          <p className="text-[13px] text-muted-foreground">Unable to load contacts.</p>
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-2">
          <Section title="Intrabank contacts">
            <div className="rounded-xl border border-border bg-surface-1 p-6">
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
            </div>
          </Section>

          <Section title="Interbank contacts">
            <div className="rounded-xl border border-border bg-surface-1 p-6">
              <p className="mb-4 text-[13px] text-muted-foreground">
                External wire recipients — ready for when NCC-Net wires launch.
              </p>
              <BankTransferContactsManager
                scope="interbank"
                contacts={data.contacts}
                onChanged={() => void router.invalidate()}
              />
            </div>
          </Section>
        </div>
      )}
    </>
  );
}
