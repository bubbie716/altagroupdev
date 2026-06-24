import { createFileRoute, Link } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalStatCard } from "@/components/internal/internal-stat-card";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { StatusBadge } from "@/components/internal/status-badge";
import { BankReviewButton } from "@/components/bank/bank-review-button";
import { BankProofStatus } from "@/components/bank/bank-proof-link";
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
import { fetchInternalStatementOps } from "@/lib/bank/statement.functions";
import type { InternalBankAccountRow, InternalBankTransactionRow } from "@/lib/bank/backend-types";
import type { BankStatementSummary } from "@/lib/bank/statement-types";
import { InternalStatementBatchButton } from "@/components/bank/internal-statement-ops";
import { RunDueTransfersButton } from "@/components/bank/internal-scheduled-transfers-panel";
import { MockActionButton } from "@/components/internal/mock-action-button";
import { getBankOpsTransfers } from "@/lib/internal/api";

export const Route = createFileRoute("/internal/bank")({
  loader: async () => {
    const [bankOps, statementOps] = await Promise.all([
      fetchInternalBankOps(),
      fetchInternalStatementOps(),
    ]);
    return { ...bankOps, statementOps };
  },
  head: () => ({ meta: [{ title: "Bank Ops — Alta Internal" }] }),
  component: InternalBank,
});

function InternalBank() {
  const {
    summary,
    accounts,
    pendingAccounts,
    pendingDeposits,
    pendingWithdrawals,
    statementOps,
  } = Route.useLoaderData();
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
        <InternalStatCard
          label="Alta Pay (MTD)"
          value={summary.altaPayCountThisMonth.toLocaleString()}
          sub={`ƒ${summary.altaPayVolumeThisMonth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} volume`}
        />
        <InternalStatCard label="Loan Applications Pending" value={String(summary.lendingQueue)} alert={summary.lendingQueue > 0} />
      </div>

      <Section title="Lending" className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-[13px] text-muted-foreground">
            Review personal, business, and private liquidity line applications.
          </p>
          <Link
            to="/internal/lending"
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-gold hover:underline"
          >
            Open lending queue →
          </Link>
        </div>
      </Section>

      <Section title="Scheduled Transfers" className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-[13px] text-muted-foreground">
            Automatic execution for approved intrabank Alta-to-Alta transfers.
          </p>
          <Link
            to="/internal/bank/scheduled"
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-gold hover:underline"
          >
            View all scheduled →
          </Link>
        </div>
        <div className="mt-4">
          <RunDueTransfersButton />
        </div>
      </Section>

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

      <Section title="Statement Operations" className="mt-10">
        <div className="mb-6 rounded-lg border border-border/60 bg-surface-2/30 p-5">
          <InternalStatementBatchButton />
        </div>
        <AdminDataTable
          columns={[
            {
              key: "number",
              header: "Statement",
              cell: (s: BankStatementSummary) => (
                <span className="font-mono text-[11px]">{s.statementNumber}</span>
              ),
            },
            {
              key: "account",
              header: "Account",
              cell: (s: BankStatementSummary) => (
                <span className="font-mono text-[11px]">{s.accountNumber}</span>
              ),
            },
            {
              key: "holder",
              header: "Holder",
              cell: (s: BankStatementSummary) => s.ownerLabel,
            },
            {
              key: "period",
              header: "Period end",
              cell: (s: BankStatementSummary) => s.periodEnd.slice(0, 10),
            },
            {
              key: "status",
              header: "Status",
              cell: (s: BankStatementSummary) => <StatusBadge status={s.statusLabel} />,
            },
            {
              key: "view",
              header: "",
              cell: (s: BankStatementSummary) => (
                <Link
                  to="/bank/statements/$statementId"
                  params={{ statementId: s.id }}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-gold hover:underline"
                >
                  View
                </Link>
              ),
            },
          ]}
          rows={statementOps.recentStatements}
          rowKey={(s) => s.id}
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-border/60 px-4 py-3 text-[13px] text-muted-foreground">
            Voided statements: {statementOps.voidedCount}
          </div>
          <div className="rounded-md border border-border/60 px-4 py-3 text-[13px] text-muted-foreground">
            {statementOps.errorPlaceholder}
          </div>
        </div>
      </Section>

      <Section title="All Accounts" className="mt-10">
        <AdminDataTable
          columns={[
            { key: "id", header: "Account", cell: (a: InternalBankAccountRow) => <span className="font-mono text-[12px]">{a.accountNumber}</span> },
            { key: "holder", header: "Holder", cell: (a: InternalBankAccountRow) => a.holder },
            { key: "product", header: "Product", cell: (a: InternalBankAccountRow) => a.product },
            { key: "balance", header: "Balance", cell: (a: InternalBankAccountRow) => <span className="type-finance">{a.balance}</span> },
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

      <Section title="Interbank Transfers (mock preview)" className="mt-10">
        <AdminDataTable
          columns={[
            { key: "id", header: "Ref", cell: (t) => <span className="font-mono text-[11px]">{t.id}</span> },
            { key: "from", header: "From", cell: (t) => <span className="font-mono text-[11px]">{t.from}</span> },
            { key: "to", header: "To", cell: (t) => <span className="font-mono text-[11px]">{t.to}</span> },
            { key: "amount", header: "Amount", cell: (t) => <span className="type-finance">{t.amount}</span> },
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
    { key: "amount", header: "Amount", cell: (r: InternalBankTransactionRow) => <span className="type-finance">{r.amount}</span> },
    { key: "method", header: "Details", cell: (r: InternalBankTransactionRow) => <span className="text-[12px]">{r.method}</span> },
    {
      key: "proof",
      header: "Proof",
      cell: (r: InternalBankTransactionRow) => (
        <BankProofStatus
          variant="internal"
          proofImageUrl={r.proofImageUrl}
          proofFileName={r.proofFileName}
          proofUploadedAt={r.proofUploadedAt}
          hasProof={r.hasProof}
        />
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
