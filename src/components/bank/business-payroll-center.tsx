"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/page-shell";
import { florin } from "@/lib/bank/api";
import {
  createPayrollEmployeeRecord,
  deactivatePayrollEmployeeRecord,
} from "@/lib/bank/business-banking.functions";
import type {
  BusinessTreasuryCompany,
  PayrollEmployeeRow,
  PayrollRunRow,
} from "@/lib/bank/business-banking-types";
import {
  getDefaultPayDay,
  getPayDayOptions,
  type PayDayCode,
} from "@/lib/bank/payroll-pay-day";

const fieldClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40";

type Tab = "registry" | "history";

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

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-1">
        {(
          [
            ["registry", "Employee registry"],
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
  const [payDay, setPayDay] = useState<PayDayCode>(getDefaultPayDay("monthly"));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const payDayOptions = getPayDayOptions(payFrequency);

  useEffect(() => {
    const options = getPayDayOptions(payFrequency);
    setPayDay((current) =>
      options.some((option) => option.value === current) ? current : getDefaultPayDay(payFrequency),
    );
  }, [payFrequency]);

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
          accountNumber,
          payAmount: Number(payAmount),
          payFrequency,
          payDay,
        },
      });
      await router.invalidate();
      setDisplayName("");
      setTitle("");
      setAccountNumber("");
      setPayAmount("");
      setPayFrequency("monthly");
      setPayDay(getDefaultPayDay("monthly"));
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
        Deposit account
        <input
          className={fieldClass}
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          placeholder="AB-0000-000000"
          required
        />
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
      <label className="block text-sm">
        Pay day
        <select
          className={fieldClass}
          value={payDay}
          onChange={(e) => setPayDay(e.target.value as PayDayCode)}
          required
        >
          {payDayOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <p className="text-[12px] text-muted-foreground">
        Salary is sent automatically at 9:00 AM Eastern on the chosen schedule.
      </p>
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
}: {
  employees: PayrollEmployeeRow[];
  company: BusinessTreasuryCompany;
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
            <th>Title</th>
            <th>Pay</th>
            <th>Schedule</th>
            <th>Status</th>
            {company.permissions.canManage && <th />}
          </tr>
        </thead>
        <tbody>
          {employees.map((e) => (
            <tr key={e.id}>
              <td>{e.displayName}</td>
              <td>{e.title ?? "—"}</td>
              <td className="tabular-nums">{florin(e.payAmount)}</td>
              <td>
                {e.payFrequencyLabel} · {e.payDayLabel}
              </td>
              <td>{e.statusLabel}</td>
              {company.permissions.canManage && e.status === "active" && (
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
          {run.lastFailureReason && run.status !== "executed" && (
            <p className="mt-2 text-[12px] text-destructive">{run.lastFailureReason}</p>
          )}
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
