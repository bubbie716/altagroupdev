import { createFileRoute } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalStatCard } from "@/components/internal/internal-stat-card";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { StatusBadge } from "@/components/internal/status-badge";
import { MockActionButton } from "@/components/internal/mock-action-button";
import {
  getBankOpsAccounts,
  getBankOpsDepositWithdrawRequests,
  getBankOpsLoanApplications,
  getBankOpsSummary,
  getBankOpsTransfers,
} from "@/lib/internal/api";
import type {
  BankDepositWithdrawRequest,
  BankLoanApplication,
  BankOpsAccount,
  BankOpsTransfer,
} from "@/lib/internal/types";

export const Route = createFileRoute("/internal/bank")({
  head: () => ({ meta: [{ title: "Bank Ops — Alta Internal" }] }),
  component: InternalBank,
});

function InternalBank() {
  const s = getBankOpsSummary();
  const accounts = getBankOpsAccounts();
  const loans = getBankOpsLoanApplications();
  const transfers = getBankOpsTransfers();
  const depositWithdraw = getBankOpsDepositWithdrawRequests();

  return (
    <InternalPageShell
      title="Bank Operations"
      description="Accounts, lending queue, interbank transfers, and deposit/withdrawal requests."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <InternalStatCard label="Accounts" value={s.totalAccounts.toLocaleString()} />
        <InternalStatCard label="Loan Applications" value={String(s.lendingQueue)} alert />
        <InternalStatCard label="Transfers In Review" value={String(s.transfersInReview)} alert />
        <InternalStatCard label="Deposits Pending" value={String(s.pendingDeposits)} />
        <InternalStatCard label="Withdrawals Pending" value={String(s.pendingWithdrawals)} alert />
        <InternalStatCard label="Private Invites" value={String(s.privateInvitesPending)} />
        <InternalStatCard label="Frozen Accounts" value={String(s.frozenAccounts)} alert />
      </div>

      <Section title="Accounts" className="mt-10">
        <AdminDataTable
          columns={[
            { key: "id", header: "Account", cell: (a: BankOpsAccount) => <span className="font-mono text-[12px]">{a.id}</span> },
            { key: "holder", header: "Holder", cell: (a: BankOpsAccount) => a.holder },
            { key: "product", header: "Product", cell: (a: BankOpsAccount) => a.product },
            { key: "balance", header: "Balance", cell: (a: BankOpsAccount) => <span className="tabular font-mono">{a.balance}</span> },
            { key: "status", header: "Status", cell: (a: BankOpsAccount) => <StatusBadge status={a.status} /> },
            {
              key: "actions",
              header: "Actions",
              cell: () => (
                <div className="flex flex-wrap gap-1">
                  <MockActionButton label="Freeze account" variant="danger" />
                  <MockActionButton label="Invite private" variant="primary" />
                </div>
              ),
            },
          ]}
          rows={accounts}
          rowKey={(a) => a.id}
        />
      </Section>

      <Section title="Loan Applications" className="mt-10">
        <AdminDataTable
          columns={[
            { key: "id", header: "Ref", cell: (l: BankLoanApplication) => <span className="font-mono text-[11px]">{l.id}</span> },
            { key: "applicant", header: "Applicant", cell: (l: BankLoanApplication) => <span className="font-mono text-[11px]">{l.applicant}</span> },
            {
              key: "company",
              header: "Company",
              cell: (l: BankLoanApplication) => l.company ?? <span className="text-muted-foreground">—</span>,
            },
            { key: "product", header: "Product", cell: (l: BankLoanApplication) => l.product },
            { key: "amount", header: "Amount", cell: (l: BankLoanApplication) => <span className="tabular font-mono">{l.amount}</span> },
            { key: "purpose", header: "Purpose", cell: (l: BankLoanApplication) => <span className="text-[12px]">{l.purpose}</span> },
            { key: "status", header: "Status", cell: (l: BankLoanApplication) => <StatusBadge status={l.status} /> },
            {
              key: "submitted",
              header: "Submitted",
              cell: (l: BankLoanApplication) => <span className="font-mono text-[11px] text-muted-foreground">{l.submitted}</span>,
            },
            {
              key: "actions",
              header: "Actions",
              cell: () => (
                <div className="flex flex-wrap gap-1">
                  <MockActionButton label="Review" />
                  <MockActionButton label="Approve" variant="primary" />
                  <MockActionButton label="Deny" variant="danger" />
                  <MockActionButton label="Request info" />
                </div>
              ),
            },
          ]}
          rows={loans}
          rowKey={(l) => l.id}
        />
      </Section>

      <Section title="Interbank Transfers & Wires" className="mt-10">
        <AdminDataTable
          columns={[
            { key: "id", header: "Ref", cell: (t: BankOpsTransfer) => <span className="font-mono text-[11px]">{t.id}</span> },
            { key: "type", header: "Type", cell: (t: BankOpsTransfer) => <span className="font-mono text-[11px]">{t.type}</span> },
            { key: "from", header: "From", cell: (t: BankOpsTransfer) => <span className="font-mono text-[11px]">{t.from}</span> },
            { key: "to", header: "To", cell: (t: BankOpsTransfer) => <span className="font-mono text-[11px]">{t.to}</span> },
            { key: "amount", header: "Amount", cell: (t: BankOpsTransfer) => <span className="tabular font-mono">{t.amount}</span> },
            { key: "settlement", header: "Settlement", cell: (t: BankOpsTransfer) => <span className="font-mono text-[11px]">{t.settlement}</span> },
            { key: "status", header: "Status", cell: (t: BankOpsTransfer) => <StatusBadge status={t.status} /> },
            {
              key: "submitted",
              header: "Submitted",
              cell: (t: BankOpsTransfer) => <span className="font-mono text-[11px] text-muted-foreground">{t.submitted}</span>,
            },
            {
              key: "actions",
              header: "Actions",
              cell: () => (
                <div className="flex flex-wrap gap-1">
                  <MockActionButton label="Review" />
                  <MockActionButton label="Release" variant="primary" />
                  <MockActionButton label="Hold" />
                  <MockActionButton label="Reject" variant="danger" />
                </div>
              ),
            },
          ]}
          rows={transfers}
          rowKey={(t) => t.id}
        />
      </Section>

      <Section title="Deposit & Withdrawal Requests" className="mt-10">
        <AdminDataTable
          columns={[
            { key: "id", header: "Ref", cell: (r: BankDepositWithdrawRequest) => <span className="font-mono text-[11px]">{r.id}</span> },
            { key: "type", header: "Type", cell: (r: BankDepositWithdrawRequest) => <StatusBadge status={r.type} /> },
            { key: "account", header: "Account", cell: (r: BankDepositWithdrawRequest) => <span className="font-mono text-[11px]">{r.account}</span> },
            { key: "holder", header: "Holder", cell: (r: BankDepositWithdrawRequest) => <span className="font-mono text-[11px]">{r.holder}</span> },
            { key: "amount", header: "Amount", cell: (r: BankDepositWithdrawRequest) => <span className="tabular font-mono">{r.amount}</span> },
            { key: "method", header: "Method", cell: (r: BankDepositWithdrawRequest) => <span className="text-[12px]">{r.method}</span> },
            { key: "status", header: "Status", cell: (r: BankDepositWithdrawRequest) => <StatusBadge status={r.status} /> },
            {
              key: "submitted",
              header: "Submitted",
              cell: (r: BankDepositWithdrawRequest) => (
                <span className="font-mono text-[11px] text-muted-foreground">{r.submitted}</span>
              ),
            },
            {
              key: "actions",
              header: "Actions",
              cell: (r: BankDepositWithdrawRequest) => (
                <div className="flex flex-wrap gap-1">
                  <MockActionButton label="Review" />
                  {r.type === "Deposit" ? (
                    <MockActionButton label="Post deposit" variant="primary" />
                  ) : (
                    <MockActionButton label="Release funds" variant="primary" />
                  )}
                  <MockActionButton label="Reject" variant="danger" />
                </div>
              ),
            },
          ]}
          rows={depositWithdraw}
          rowKey={(r) => r.id}
        />
      </Section>
    </InternalPageShell>
  );
}
