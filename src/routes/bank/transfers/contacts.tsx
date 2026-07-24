import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { TransferPageHeader } from "@/components/bank/transfer-page-header";
import { BankTransferContactsManager } from "@/components/bank/bank-transfer-contacts-manager";
import { fetchActiveBankAccounts, fetchAllTransferContacts } from "@/lib/bank/bank.functions";

export const Route = createFileRoute("/bank/transfers/contacts")({
  loader: async () => {
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
  const data = Route.useLoaderData();
  const router = useRouter();

  return (
    <>
      <BankPageMeta
      eyebrow="Alta Bank · Transfers"
      title="Contacts"
      description="Saved Alta Pay recipients now. External wire beneficiaries for coming-soon interbank wires."
     />
<TransferPageHeader />

      {!data ? (
        <div className="rounded-xl border border-dashed border-border bg-surface-1/40 px-6 py-10 text-center">
          <p className="text-[13px] text-muted-foreground">Unable to load contacts.</p>
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-2">
          <Section title="Intrabank contacts">
            <div className="rounded-xl border border-border bg-surface-1 p-6">
              <p className="mb-4 text-[13px] text-muted-foreground">
                Shortcuts for Alta Pay to other Alta customers.
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
                External wire recipients — coming soon. Intrabank transfers between your Alta Bank
                accounts are available under Transfers → Intrabank.
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
