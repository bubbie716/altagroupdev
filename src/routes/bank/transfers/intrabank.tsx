import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Section, Card } from "@/components/page-shell";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { TransferPageHeader } from "@/components/bank/transfer-page-header";
import { BankInternalTransferForm } from "@/components/bank/bank-internal-transfer-form";
import { ScheduledTransferCenter } from "@/components/bank/scheduled-transfer-center";
import { EmptyBankState } from "@/components/data/empty-bank-state";
import { florin } from "@/lib/bank/api";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { fetchActiveBankAccounts, fetchUserInternalTransfers } from "@/lib/bank/bank.functions";
import {
  cancelUserScheduledTransferRecord,
  createUserScheduledTransferRecord,
  fetchUserScheduledTransfers,
} from "@/lib/bank/scheduled-transfer.functions";
import type { UserBankTransfer } from "@/lib/bank/backend-types";
import {
  BankMobileStack,
  BankMobileStackField,
  BankMobileStackRow,
  BankTableScroll,
} from "@/components/bank/bank-scroll-contain";

type BankIntrabankSearch = {
  accountId?: string;
};

export const Route = createFileRoute("/bank/transfers/intrabank")({
  validateSearch: (search: Record<string, unknown>): BankIntrabankSearch => ({
    accountId: typeof search.accountId === "string" ? search.accountId : undefined,
  }),
  loader: async () => {
    const [accounts, transfers, scheduledTransfers] = await Promise.all([
      fetchActiveBankAccounts(),
      fetchUserInternalTransfers({ data: 20 }),
      fetchUserScheduledTransfers({ data: "intrabank" }),
    ]);
    return { accounts, transfers, scheduledTransfers };
  },
  head: () => ({
    meta: [{ title: "Intrabank Transfers — Alta Bank" }],
  }),
  component: BankIntrabankTransfers,
});

function BankIntrabankTransfers() {
  const data = Route.useLoaderData();
  const { accountId } = Route.useSearch();
  const router = useRouter();

  return (
    <>
      <BankPageMeta
      eyebrow="Alta Bank · Transfers"
      title="Intrabank"
      description="Move money between your own Alta Bank accounts."
     />
{!data || data.accounts.length === 0 ? (
        <>
          <TransferPageHeader title="Internal transfer · Instant settlement" accountId={accountId} />
          <EmptyBankState
          title="No active Alta Bank accounts yet."
          description="Open at least two Alta Bank accounts to move money between your own positions."
        />
        </>
      ) : (
        <>
          <TransferPageHeader title="Internal transfer · Instant settlement" accountId={accountId} />
          <BankInternalTransferForm
            accounts={data.accounts}
            defaultFromAccountId={accountId}
            onSuccess={() => void router.invalidate()}
          />

          {data.accounts.length >= 2 && (
            <Section title="Scheduled & recurring transfers" className="mt-10">
              <p className="mb-4 text-[13px] text-muted-foreground">
                Schedule one-time or recurring transfers between your own Alta Bank accounts. To pay other people or
                businesses, use Alta Pay.
              </p>
              <IntrabankScheduledTransfers data={data} defaultSourceAccountId={accountId} />
            </Section>
          )}

          <Section title="Transfer history" className="mt-10">
            <InternalTransferHistory transfers={data.transfers} />
          </Section>
        </>
      )}
    </>
  );
}

function IntrabankScheduledTransfers({
  data,
  defaultSourceAccountId,
}: {
  data: NonNullable<ReturnType<typeof Route.useLoaderData>>;
  defaultSourceAccountId?: string;
}) {
  const createTransfer = useServerFn(createUserScheduledTransferRecord);
  const cancelTransfer = useServerFn(cancelUserScheduledTransferRecord);

  const accountOptions = data.accounts.map((account) => ({
    id: account.id,
    accountName: account.accountName,
    accountNumber: account.accountNumber,
    ownerLabel: account.companyName ?? "Personal",
  }));

  return (
    <ScheduledTransferCenter
      transferScope="intrabank"
      defaultSourceAccountId={defaultSourceAccountId}
      sourceAccounts={accountOptions}
      destinationAccounts={accountOptions}
      payments={data.scheduledTransfers}
      canManage
      onCreate={async (input) => {
        await createTransfer({ data: { ...input, transferScope: "intrabank" } });
      }}
      onCancel={async (paymentId) => {
        await cancelTransfer({ data: { paymentId, transferScope: "intrabank" } });
      }}
    />
  );
}

function signedTransferAmount(transfer: UserBankTransfer): number {
  return transfer.direction === "received" ? transfer.amount : -transfer.amount;
}

function TransferHistoryAmount({
  transfer,
  className,
}: {
  transfer: UserBankTransfer;
  className?: string;
}) {
  const signed = signedTransferAmount(transfer);
  return (
    <span
      className={`tabular font-medium ${signed >= 0 ? "ticker-up" : "ticker-down"} ${className ?? ""}`}
    >
      {signed >= 0 ? "+" : ""}
      {florin(signed)}
    </span>
  );
}

function InternalTransferHistory({ transfers }: { transfers: UserBankTransfer[] }) {
  if (transfers.length === 0) {
    return (
      <Card className="!p-8 text-center">
        <p className="text-[14px] text-muted-foreground">No intrabank transfers yet.</p>
      </Card>
    );
  }

  return (
    <Card className="min-w-0 !p-0 overflow-hidden">
      <BankMobileStack>
        {transfers.map((transfer) => (
          <BankMobileStackRow key={`${transfer.id}-${transfer.direction}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[11px] capitalize">{transfer.direction}</p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {formatActivityDateTime(transfer.createdAt)}
                </p>
              </div>
              <TransferHistoryAmount transfer={transfer} className="shrink-0" />
            </div>
            <BankMobileStackField label="From">
              {transfer.fromAccountName} · {transfer.fromAccountNumber}
            </BankMobileStackField>
            <BankMobileStackField label="To">
              {transfer.toAccountName} · {transfer.toAccountNumber}
            </BankMobileStackField>
            <BankMobileStackField label="Reference">{transfer.referenceCode}</BankMobileStackField>
          </BankMobileStackRow>
        ))}
      </BankMobileStack>

      <BankTableScroll>
        <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border text-left type-meta">
            <th className="px-5 py-3">Date & time</th>
            <th className="px-5 py-3">Direction</th>
            <th className="px-5 py-3">From</th>
            <th className="px-5 py-3">To</th>
            <th className="px-5 py-3">Reference</th>
            <th className="px-5 py-3 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {transfers.map((transfer) => (
            <tr
              key={`${transfer.id}-${transfer.direction}`}
              className="border-b border-border/50 last:border-0 hover:bg-surface-2/40"
            >
              <td className="px-5 py-3 font-mono text-[12px] text-muted-foreground">
                {formatActivityDateTime(transfer.createdAt)}
              </td>
              <td className="px-5 py-3 font-mono text-[11px] capitalize">{transfer.direction}</td>
              <td className="px-5 py-3">
                <div>{transfer.fromAccountName}</div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  {transfer.fromAccountNumber}
                </div>
              </td>
              <td className="px-5 py-3">
                <div>{transfer.toAccountName}</div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  {transfer.toAccountNumber}
                </div>
              </td>
              <td className="px-5 py-3 font-mono text-[11px] text-muted-foreground">
                {transfer.referenceCode}
              </td>
              <td className="px-5 py-3 text-right">
                <TransferHistoryAmount transfer={transfer} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </BankTableScroll>
    </Card>
  );
}
