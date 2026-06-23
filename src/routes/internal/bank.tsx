import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalStatCard } from "@/components/internal/internal-stat-card";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { StatusBadge } from "@/components/internal/status-badge";
import { BankReviewButton } from "@/components/bank/bank-review-button";
import {
  approveBankAccountOpening,
  approveBankDeposit,
  approveBankWithdrawal,
  denyBankDeposit,
  denyBankWithdrawal,
  fetchInternalBankOps,
  freezeBankAccountRecord,
  unfreezeBankAccountRecord,
} from "@/lib/bank/bank.functions";
import type { InternalBankAccountRow, InternalBankTransactionRow } from "@/lib/bank/backend-types";
import { MockActionButton } from "@/components/internal/mock-action-button";
import {
  getBankOpsLoanApplications,
  getBankOpsTransfers,
} from "@/lib/internal/api";

export const Route = createFileRoute("/internal/bank")({
  loader: () => fetchInternalBankOps(),
  head: () => ({ meta: [{ title: "Bank Ops — Alta Internal" }] }),
  component: InternalBank,
});

function InternalBank() {
  const { summary, accounts, pendingAccounts, pendingDeposits, pendingWithdrawals } =
    Route.useLoaderData();
  const loans = getBankOpsLoanApplications();
  const transfers = getBankOpsTransfers();

  return (
    <InternalPageShell
      title="Bank Operations"
      description="Live Alta Bank accounts, deposit/withdrawal review queue, and account openings."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <InternalStatCard label="Accounts" value={summary.totalAccounts.toLocaleString()} />
        <InternalStatCard label="Account Openings Pending" value={String(summary.pendingAccountOpenings)} alert />
        <InternalStatCard label="Deposits Pending" value={String(summary.pendingDeposits)} alert />
        <InternalStatCard label="Withdrawals Pending" value={String(summary.pendingWithdrawals)} alert />
        <InternalStatCard label="Frozen Accounts" value={String(summary.frozenAccounts)} alert />
        <InternalStatCard label="Loan Applications (mock)" value={String(summary.lendingQueue)} />
      </div>

      <Section title="Pending Account Openings" className="mt-10">
        <AdminDataTable
          columns={[
            { key: "id", header: "Account", cell: (a: InternalBankAccountRow) => <span className="font-mono text-[12px]">{a.accountNumber}</span> },
            { key: "name", header: "Name", cell: (a: InternalBankAccountRow) => a.accountName },
            { key: "holder", header: "Holder", cell: (a: InternalBankAccountRow) => a.holder },
            { key: "product", header: "Product", cell: (a: InternalBankAccountRow) => a.product },
            { key: "status", header: "Status", cell: (a: InternalBankAccountRow) => <StatusBadge status={a.status} /> },
            {
              key: "actions",
              header: "Actions",
              cell: (a: InternalBankAccountRow) => (
                <BankReviewButton
                  label="Approve account"
                  variant="primary"
                  onAction={async () => {
                    await approveBankAccountOpening({ data: { accountId: a.id } });
                  }}
                />
              ),
            },
          ]}
          rows={pendingAccounts}
          rowKey={(a) => a.id}
        />
      </Section>

      <Section title="Pending Deposit Requests" className="mt-10">
        <AdminDataTable
          columns={depositWithdrawColumns("deposit")}
          rows={pendingDeposits}
          rowKey={(r) => r.id}
        />
      </Section>

      <Section title="Pending Withdrawal Requests" className="mt-10">
        <AdminDataTable
          columns={depositWithdrawColumns("withdrawal")}
          rows={pendingWithdrawals}
          rowKey={(r) => r.id}
        />
      </Section>

      <Section title="All Accounts" className="mt-10">
        <AdminDataTable
          columns={[
            { key: "id", header: "Account", cell: (a: InternalBankAccountRow) => <span className="font-mono text-[12px]">{a.accountNumber}</span> },
            { key: "holder", header: "Holder", cell: (a: InternalBankAccountRow) => a.holder },
            { key: "product", header: "Product", cell: (a: InternalBankAccountRow) => a.product },
            { key: "balance", header: "Balance", cell: (a: InternalBankAccountRow) => <span className="tabular font-mono">{a.balance}</span> },
            { key: "status", header: "Status", cell: (a: InternalBankAccountRow) => <StatusBadge status={a.status} /> },
            {
              key: "actions",
              header: "Actions",
              cell: (a: InternalBankAccountRow) => (
                <div className="flex flex-wrap gap-1">
                  {a.status === "Pending Review" && (
                    <BankReviewButton
                      label="Approve"
                      variant="primary"
                      onAction={async () => {
                        await approveBankAccountOpening({ data: { accountId: a.id } });
                      }}
                    />
                  )}
                  {a.status === "Active" && (
                    <BankReviewButton
                      label="Freeze"
                      variant="danger"
                      onAction={async () => {
                        await freezeBankAccountRecord({ data: { accountId: a.id } });
                      }}
                    />
                  )}
                  {a.status === "Frozen" && (
                    <BankReviewButton
                      label="Unfreeze"
                      variant="primary"
                      onAction={async () => {
                        await unfreezeBankAccountRecord({ data: { accountId: a.id } });
                      }}
                    />
                  )}
                </div>
              ),
            },
          ]}
          rows={accounts}
          rowKey={(a) => a.id}
        />
      </Section>

      <Section title="Loan Applications (mock preview)" className="mt-10">
        <AdminDataTable
          columns={[
            { key: "id", header: "Ref", cell: (l) => <span className="font-mono text-[11px]">{l.id}</span> },
            { key: "applicant", header: "Applicant", cell: (l) => <span className="font-mono text-[11px]">{l.applicant}</span> },
            { key: "amount", header: "Amount", cell: (l) => <span className="tabular font-mono">{l.amount}</span> },
            { key: "status", header: "Status", cell: (l) => <StatusBadge status={l.status} /> },
            {
              key: "actions",
              header: "Actions",
              cell: () => <MockActionButton label="Review (mock)" />,
            },
          ]}
          rows={loans}
          rowKey={(l) => l.id}
        />
      </Section>

      <Section title="Interbank Transfers (mock preview)" className="mt-10">
        <AdminDataTable
          columns={[
            { key: "id", header: "Ref", cell: (t) => <span className="font-mono text-[11px]">{t.id}</span> },
            { key: "from", header: "From", cell: (t) => <span className="font-mono text-[11px]">{t.from}</span> },
            { key: "to", header: "To", cell: (t) => <span className="font-mono text-[11px]">{t.to}</span> },
            { key: "amount", header: "Amount", cell: (t) => <span className="tabular font-mono">{t.amount}</span> },
            { key: "status", header: "Status", cell: (t) => <StatusBadge status={t.status} /> },
            {
              key: "actions",
              header: "Actions",
              cell: () => <MockActionButton label="Review (mock)" />,
            },
          ]}
          rows={transfers}
          rowKey={(t) => t.id}
        />
      </Section>
    </InternalPageShell>
  );
}

function depositWithdrawColumns(kind: "deposit" | "withdrawal") {
  return [
    { key: "ref", header: "Ref", cell: (r: InternalBankTransactionRow) => <span className="font-mono text-[11px]">{r.referenceCode}</span> },
    { key: "account", header: "Account", cell: (r: InternalBankTransactionRow) => <span className="font-mono text-[11px]">{r.account}</span> },
    { key: "holder", header: "Holder", cell: (r: InternalBankTransactionRow) => <span className="font-mono text-[11px]">{r.holder}</span> },
    { key: "amount", header: "Amount", cell: (r: InternalBankTransactionRow) => <span className="tabular font-mono">{r.amount}</span> },
    { key: "method", header: "Details", cell: (r: InternalBankTransactionRow) => <span className="text-[12px]">{r.method}</span> },
    {
      key: "proof",
      header: "Proof",
      cell: (r: InternalBankTransactionRow) =>
        r.proofImageUrl ? (
          <span className="font-mono text-[10px] text-muted-foreground">{r.proofImageUrl}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { key: "status", header: "Status", cell: (r: InternalBankTransactionRow) => <StatusBadge status={r.status} /> },
    {
      key: "actions",
      header: "Actions",
      cell: (r: InternalBankTransactionRow) => (
        <div className="flex flex-wrap gap-1">
          <BankReviewButton
            label={kind === "deposit" ? "Approve deposit" : "Approve withdrawal"}
            variant="primary"
            onAction={async () => {
              if (kind === "deposit") {
                await approveBankDeposit({ data: { transactionId: r.id } });
              } else {
                await approveBankWithdrawal({ data: { transactionId: r.id } });
              }
            }}
          />
          <BankReviewButton
            label="Deny"
            variant="danger"
            onAction={async () => {
              if (kind === "deposit") {
                await denyBankDeposit({ data: { transactionId: r.id } });
              } else {
                await denyBankWithdrawal({ data: { transactionId: r.id } });
              }
            }}
          />
        </div>
      ),
    },
  ];
}
