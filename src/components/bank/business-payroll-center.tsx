"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/page-shell";
import { florin } from "@/lib/bank/api";
import {
  createPayrollEmployeeRecord,
  createPayrollRunRecord,
  deactivatePayrollEmployeeRecord,
} from "@/lib/bank/business-banking.functions";
import type {
  BusinessTreasuryCompany,
  PayrollEmployeeRow,
  PayrollRunRow,
} from "@/lib/bank/business-banking-types";

const fieldClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40";

type Tab = "registry" | "run" | "history";

export function BusinessPayrollCenter({
  company,
  employees,
  runs,
}: {
  company: BusinessTreasuryCompany;
  employees: PayrollEmployeeRow[];
  runs: PayrollRunRow[];
}) {
  const [tab, setTab] = useState<Tab>("registry");
  const canManage = company.permissions.canManage;
  const activeEmployees = employees.filter((e) => e.status === "active");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-1">
        {(
          [
            ["registry", "Employee registry"],
            ["run", "Run payroll"],
            ["history", "Payroll history"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-md px-3 py-1.5 text-[12px] tracking-wide transition-colors ${
              tab === id
                ? "bg-surface-2 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "registry" && (
        <div className="grid gap-8 lg:grid-cols-2">
          {canManage ? (
            <Card className="!p-6">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
                Add employee
              </div>
              <EmployeeForm companyId={company.companyId} />
            </Card>
          ) : (
            <Card className="!p-6">
              <p className="text-[13px] text-muted-foreground">
                View-only access. Payroll changes require owner, executive, or finance manager approval.
              </p>
            </Card>
          )}
          <Card className="!p-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Employee registry
            </div>
            <EmployeeTable employees={employees} company={company} />
          </Card>
        </div>
      )}

      {tab === "run" && (
        <div className="grid gap-8 lg:grid-cols-2">
          {canManage ? (
            <Card className="!p-6">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
                Payroll batch
              </div>
              <PayrollRunForm company={company} employees={activeEmployees} />
            </Card>
          ) : (
            <Card className="!p-6">
              <p className="text-[13px] text-muted-foreground">
                View-only access. Running payroll requires treasury management permissions.
              </p>
            </Card>
          )}
          <Card className="!p-6">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Active employees ({activeEmployees.length})
            </div>
            <EmployeeTable employees={activeEmployees} company={company} compact />
          </Card>
        </div>
      )}

      {tab === "history" && (
        <Card className="!p-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Payroll history
          </div>
          <PayrollHistoryTable runs={runs} />
        </Card>
      )}
    </div>
  );
}

function EmployeeForm({ companyId }: { companyId: string }) {
  const router = useRouter();
  const createEmployee = useServerFn(createPayrollEmployeeRecord);
  const [displayName, setDisplayName] = useState("");
  const [title, setTitle] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payFrequency, setPayFrequency] = useState<"weekly" | "biweekly" | "monthly" | "quarterly">("monthly");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await createEmployee({
        data: {
          companyId,
          displayName,
          title: title || undefined,
          accountNumber: accountNumber || undefined,
          payAmount: Number(payAmount),
          payFrequency,
        },
      });
      await router.invalidate();
      setDisplayName("");
      setTitle("");
      setAccountNumber("");
      setPayAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Failed to add employee.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <label className="block text-sm">
        Name
        <input className={fieldClass} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
      </label>
      <label className="block text-sm">
        Title (optional)
        <input className={fieldClass} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="block text-sm">
        Deposit account (optional)
        <input className={fieldClass} value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
      </label>
      <label className="block text-sm">
        Pay amount (FLR)
        <input
          className={fieldClass}
          type="number"
          min="0.01"
          step="0.01"
          value={payAmount}
          onChange={(e) => setPayAmount(e.target.value)}
          required
        />
      </label>
      <label className="block text-sm">
        Pay frequency
        <select
          className={fieldClass}
          value={payFrequency}
          onChange={(e) => setPayFrequency(e.target.value as typeof payFrequency)}
        >
          <option value="weekly">Weekly</option>
          <option value="biweekly">Biweekly</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
        </select>
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-border-strong bg-surface-2 px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-2/80 disabled:opacity-50"
      >
        {pending ? "Saving…" : "Add employee"}
      </button>
    </form>
  );
}

function EmployeeTable({
  employees,
  company,
  compact = false,
}: {
  employees: PayrollEmployeeRow[];
  company: BusinessTreasuryCompany;
  compact?: boolean;
}) {
  const router = useRouter();
  const deactivate = useServerFn(deactivatePayrollEmployeeRecord);

  if (employees.length === 0) {
    return <p className="mt-4 text-[13px] text-muted-foreground">No employees registered yet.</p>;
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="alta-table w-full min-w-[480px] text-sm">
        <thead>
          <tr>
            <th>Name</th>
            {!compact && <th>Title</th>}
            <th>Pay</th>
            {!compact && <th>Frequency</th>}
            <th>Status</th>
            {company.permissions.canManage && !compact && <th />}
          </tr>
        </thead>
        <tbody>
          {employees.map((e) => (
            <tr key={e.id}>
              <td>{e.displayName}</td>
              {!compact && <td>{e.title ?? "—"}</td>}
              <td className="tabular-nums">{florin(e.payAmount)}</td>
              {!compact && <td>{e.payFrequencyLabel}</td>}
              <td>{e.statusLabel}</td>
              {company.permissions.canManage && !compact && e.status === "active" && (
                <td>
                  <button
                    type="button"
                    className="font-mono text-[10px] uppercase tracking-[0.14em] text-destructive hover:underline"
                    onClick={async () => {
                      await deactivate({ data: { companyId: company.companyId, employeeId: e.id } });
                      await router.invalidate();
                    }}
                  >
                    Deactivate
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PayrollRunForm({
  company,
  employees,
}: {
  company: BusinessTreasuryCompany;
  employees: PayrollEmployeeRow[];
}) {
  const router = useRouter();
  const createRun = useServerFn(createPayrollRunRecord);
  const [label, setLabel] = useState("");
  const [payDate, setPayDate] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [memo, setMemo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const total = employees
    .filter((e) => selected.includes(e.id))
    .reduce((sum, e) => sum + e.payAmount, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await createRun({
        data: {
          companyId: company.companyId,
          bankAccountId: company.operatingAccount.id,
          label,
          payDate,
          employeeIds: selected,
          memo: memo || undefined,
        },
      });
      await router.invalidate();
      setLabel("");
      setPayDate("");
      setSelected([]);
      setMemo("");
    } catch (err) {
      setError(err instanceof Error ? err.message.replace(/^BAD_REQUEST:/, "") : "Payroll submission failed.");
    } finally {
      setPending(false);
    }
  }

  if (employees.length === 0) {
    return (
      <p className="mt-6 text-[13px] text-muted-foreground">
        Add active employees before running payroll.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <label className="block text-sm">
        Batch label
        <input className={fieldClass} value={label} onChange={(e) => setLabel(e.target.value)} required />
      </label>
      <label className="block text-sm">
        Pay date
        <input
          className={fieldClass}
          type="date"
          value={payDate}
          onChange={(e) => setPayDate(e.target.value)}
          required
        />
      </label>
      <fieldset>
        <legend className="text-sm font-medium">Employees</legend>
        <div className="mt-2 space-y-2">
          {employees.map((e) => (
            <label key={e.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(e.id)}
                onChange={(ev) => {
                  setSelected((prev) =>
                    ev.target.checked ? [...prev, e.id] : prev.filter((id) => id !== e.id),
                  );
                }}
              />
              <span>{e.displayName}</span>
              <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
                {florin(e.payAmount)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="rounded-md border border-border/60 bg-surface-2/50 px-3 py-2 text-sm">
        Batch total: <span className="font-mono tabular-nums">{florin(total)}</span>
      </div>
      <label className="block text-sm">
        Memo (optional)
        <textarea className={`${fieldClass} min-h-[4rem] resize-none`} value={memo} onChange={(e) => setMemo(e.target.value)} />
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={pending || selected.length === 0}
        className="rounded-md border border-border-strong bg-surface-2 px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-2/80 disabled:opacity-50"
      >
        {pending ? "Submitting…" : "Submit payroll for review"}
      </button>
    </form>
  );
}

function PayrollHistoryTable({ runs }: { runs: PayrollRunRow[] }) {
  if (runs.length === 0) {
    return <p className="mt-6 text-[13px] text-muted-foreground">No payroll batches yet.</p>;
  }

  return (
    <div className="mt-6 space-y-6">
      {runs.map((run) => (
        <div key={run.id} className="border-b border-border/60 pb-6 last:border-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="font-medium">{run.label}</div>
            <div className="font-mono text-sm tabular-nums">{florin(run.totalAmount)}</div>
          </div>
          <div className="mt-1 flex flex-wrap gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <span>{run.statusLabel}</span>
            <span>Pay date {new Date(run.payDate).toLocaleDateString()}</span>
            <span>{run.lineItems.length} employees</span>
          </div>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {run.lineItems.map((line) => (
              <li key={line.employeeId} className="flex justify-between gap-4">
                <span>{line.displayName}</span>
                <span className="font-mono tabular-nums">{florin(line.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
