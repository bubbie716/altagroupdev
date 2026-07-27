"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/page-shell";
import { florin } from "@/lib/bank/api";
import { formatDueDate } from "@/lib/format-datetime";
import {
  createPayrollEmployeeRecord,
  createPayrollRunRecord,
  deactivatePayrollEmployeeRecord,
  updatePayrollEmployeeRecord,
} from "@/lib/bank/business-banking.functions";
import type {
  BusinessTreasuryCompany,
  PaymentFrequencyCode,
  PayrollEmployeeRow,
  PayrollRunRow,
} from "@/lib/bank/business-banking-types";
import {
  getDefaultPayDay,
  getPayDayOptions,
  isValidPayDay,
  type PayDayCode,
} from "@/lib/bank/payroll-pay-day";
import { ResponsiveBankAction } from "@/components/bank/actions/responsive-bank-action";
import {
  BankActionFooter,
  BankActionPrimaryButton,
  BankActionSecondaryButton,
} from "@/components/bank/actions/bank-action-buttons";
import type { BankActionPhase } from "@/lib/bank/bank-action-flow";
import {
  BankMobileStack,
  BankMobileStackField,
  BankMobileStackRow,
  BankTableScroll,
} from "@/components/bank/bank-scroll-contain";
import { cn } from "@/lib/utils";

const fieldClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm shadow-none focus-visible:outline-none focus-visible:border-gold/60 focus-visible:ring-0 focus-visible:shadow-none";

const tabButtonClass = (active: boolean) =>
  cn(
    "min-h-11 rounded-md px-4 text-[13px] tracking-wide transition-colors",
    active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground",
  );

type Tab = "registry" | "history";

type EmployeeDraft = {
  displayName: string;
  title: string;
  accountNumber: string;
  payAmount: string;
  payFrequency: PaymentFrequencyCode;
  payDay: PayDayCode;
};

function emptyEmployeeDraft(): EmployeeDraft {
  return {
    displayName: "",
    title: "",
    accountNumber: "",
    payAmount: "",
    payFrequency: "monthly",
    payDay: getDefaultPayDay("monthly"),
  };
}

function draftFromEmployee(employee: PayrollEmployeeRow): EmployeeDraft {
  return {
    displayName: employee.displayName,
    title: employee.title ?? "",
    accountNumber: employee.accountNumber,
    payAmount: String(employee.payAmount),
    payFrequency: employee.payFrequency,
    payDay: isValidPayDay(employee.payFrequency, employee.payDay)
      ? (employee.payDay as PayDayCode)
      : getDefaultPayDay(employee.payFrequency),
  };
}

export function BusinessPayrollCenter({
  company,
  employees,
  runs,
  accountId: _accountId,
}: {
  company: BusinessTreasuryCompany;
  employees: PayrollEmployeeRow[];
  runs: PayrollRunRow[];
  accountId?: string;
}) {
  const [tab, setTab] = useState<Tab>("registry");
  const canManage = company.permissions.canManage;
  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.status === "active"),
    [employees],
  );

  return (
    <div className="space-y-6 pb-[calc(var(--bank-mobile-nav-offset)+0.5rem)] md:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
              className={tabButtonClass(tab === id)}
            >
              {label}
            </button>
          ))}
        </div>
        {canManage && tab === "registry" ? (
          <div className="flex flex-wrap gap-2">
            <EmployeeActionSheet
              companyId={company.companyId}
              mode="create"
              triggerLabel="Add employee"
            />
            <SchedulePayrollSheet company={company} employees={activeEmployees} />
          </div>
        ) : null}
      </div>

      {tab === "registry" ? (
        <Card className="min-w-0 !p-0">
          <div className="border-b border-border px-5 py-4 sm:px-6">
            <div className="type-meta">Employee registry</div>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
              Active employees are paid automatically on their schedule. Use Schedule payroll for an
              extra one-time batch with an explicit review before it runs.
            </p>
          </div>
          {!canManage ? (
            <p className="px-5 py-4 text-[13px] text-muted-foreground sm:px-6">
              View-only access. Payroll changes require owner, executive, or finance manager
              approval.
            </p>
          ) : null}
          <EmployeeRegistry
            employees={employees}
            company={company}
            canManage={canManage}
          />
        </Card>
      ) : (
        <Card className="min-w-0 !p-0">
          <div className="border-b border-border px-5 py-4 sm:px-6">
            <div className="type-meta">Payroll history</div>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Scheduled and completed salary batches for this company.
            </p>
          </div>
          <PayrollHistoryList runs={runs} />
        </Card>
      )}
    </div>
  );
}

function EmployeeRegistry({
  employees,
  company,
  canManage,
}: {
  employees: PayrollEmployeeRow[];
  company: BusinessTreasuryCompany;
  canManage: boolean;
}) {
  const router = useRouter();
  const deactivate = useServerFn(deactivatePayrollEmployeeRecord);

  if (employees.length === 0) {
    return (
      <p className="px-5 py-8 text-[13px] text-muted-foreground sm:px-6">
        No employees registered yet.
      </p>
    );
  }

  return (
    <>
      <BankMobileStack>
        {employees.map((employee) => (
          <BankMobileStackRow key={employee.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium break-words">{employee.displayName}</p>
                <p className="mt-1 text-xs text-muted-foreground">{employee.title ?? "—"}</p>
              </div>
              <span className="type-finance-nums shrink-0">{florin(employee.payAmount)}</span>
            </div>
            <BankMobileStackField label="Schedule">
              {employee.payFrequencyLabel} · {employee.payDayLabel}
            </BankMobileStackField>
            <BankMobileStackField label="Status">{employee.statusLabel}</BankMobileStackField>
            {canManage ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <EmployeeActionSheet
                  companyId={company.companyId}
                  mode="edit"
                  employee={employee}
                  triggerLabel="Edit"
                  triggerClassName="min-h-11 rounded-md border border-border px-3 text-sm font-medium"
                />
                {employee.status === "active" ? (
                  <button
                    type="button"
                    className="min-h-11 rounded-md border border-border px-3 text-sm font-medium text-destructive"
                    onClick={async () => {
                      await deactivate({
                        data: { companyId: company.companyId, employeeId: employee.id },
                      });
                      await router.invalidate();
                    }}
                  >
                    Deactivate
                  </button>
                ) : null}
              </div>
            ) : null}
          </BankMobileStackRow>
        ))}
      </BankMobileStack>

      <BankTableScroll>
        <table className="alta-table w-full min-w-[560px] text-sm">
          <thead>
            <tr>
              <th>Name</th>
              <th>Title</th>
              <th>Pay</th>
              <th>Schedule</th>
              <th>Status</th>
              {canManage ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id}>
                <td>{employee.displayName}</td>
                <td>{employee.title ?? "—"}</td>
                <td className="tabular-nums">{florin(employee.payAmount)}</td>
                <td>
                  {employee.payFrequencyLabel} · {employee.payDayLabel}
                </td>
                <td>{employee.statusLabel}</td>
                {canManage ? (
                  <td>
                    <div className="flex flex-wrap justify-end gap-2">
                      <EmployeeActionSheet
                        companyId={company.companyId}
                        mode="edit"
                        employee={employee}
                        triggerLabel="Edit"
                        triggerClassName="min-h-11 rounded-md border border-border px-3 text-sm font-medium"
                      />
                      {employee.status === "active" ? (
                        <button
                          type="button"
                          className="min-h-11 rounded-md border border-border px-3 text-sm font-medium text-destructive"
                          onClick={async () => {
                            await deactivate({
                              data: { companyId: company.companyId, employeeId: employee.id },
                            });
                            await router.invalidate();
                          }}
                        >
                          Deactivate
                        </button>
                      ) : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </BankTableScroll>
    </>
  );
}

function EmployeeActionSheet({
  companyId,
  mode,
  employee = null,
  triggerLabel,
  triggerClassName,
}: {
  companyId: string;
  mode: "create" | "edit";
  employee?: PayrollEmployeeRow | null;
  triggerLabel: string;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const createEmployee = useServerFn(createPayrollEmployeeRecord);
  const updateEmployee = useServerFn(updatePayrollEmployeeRecord);

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<BankActionPhase>("details");
  const [draft, setDraft] = useState<EmployeeDraft>(emptyEmployeeDraft);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const payDayOptions = getPayDayOptions(draft.payFrequency);
  const isEditing = mode === "edit" && employee != null;
  const dirty =
    phase === "review" ||
    phase === "submitting" ||
    draft.displayName.trim().length > 0 ||
    draft.accountNumber.trim().length > 0 ||
    draft.payAmount.trim().length > 0;

  useEffect(() => {
    if (!open) return;
    setDraft(employee ? draftFromEmployee(employee) : emptyEmployeeDraft());
    setPhase("details");
    setError(null);
    setPending(false);
  }, [open, employee]);

  useEffect(() => {
    const options = getPayDayOptions(draft.payFrequency);
    setDraft((current) =>
      options.some((option) => option.value === current.payDay)
        ? current
        : { ...current, payDay: getDefaultPayDay(current.payFrequency) },
    );
  }, [draft.payFrequency]);

  function validateDraft(): string | null {
    if (!draft.displayName.trim()) return "Employee name is required.";
    if (!draft.accountNumber.trim()) return "Deposit account is required.";
    const amount = Number(draft.payAmount);
    if (!Number.isFinite(amount) || amount <= 0) return "Pay amount must be greater than zero.";
    if (!isValidPayDay(draft.payFrequency, draft.payDay)) {
      return "Select a valid pay day for this frequency.";
    }
    return null;
  }

  async function submit() {
    setPending(true);
    setPhase("submitting");
    setError(null);
    try {
      const payload = {
        companyId,
        displayName: draft.displayName.trim(),
        title: draft.title.trim() || undefined,
        accountNumber: draft.accountNumber.trim(),
        payAmount: Number(draft.payAmount),
        payFrequency: draft.payFrequency,
        payDay: draft.payDay,
      };
      if (isEditing && employee) {
        await updateEmployee({ data: { ...payload, employeeId: employee.id } });
      } else {
        await createEmployee({ data: payload });
      }
      setPhase("success");
      await router.invalidate();
    } catch (err) {
      setPhase("error");
      setError(
        err instanceof Error
          ? err.message.replace(/^BAD_REQUEST:/, "")
          : isEditing
            ? "Failed to update employee."
            : "Failed to add employee.",
      );
    } finally {
      setPending(false);
    }
  }

  const payDayLabel =
    payDayOptions.find((option) => option.value === draft.payDay)?.label ?? draft.payDay;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          "inline-flex min-h-11 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background"
        }
      >
        {triggerLabel}
      </button>
      <ResponsiveBankAction
        open={open}
        onOpenChange={setOpen}
        title={isEditing ? "Edit employee" : "Add employee"}
        description={
          isEditing
            ? "Update pay details. Schedule changes apply on the next pay cycle."
            : "Register an employee for automatic payroll from your Business Operating Account."
        }
        phase={phase}
        dirty={dirty}
        size="md"
        showBack={phase === "review" || phase === "error"}
        onBack={() => {
          setPhase("details");
          setError(null);
        }}
        footer={
          phase === "success" ? (
            <BankActionFooter>
              <BankActionPrimaryButton onClick={() => setOpen(false)}>Done</BankActionPrimaryButton>
            </BankActionFooter>
          ) : phase === "review" || phase === "submitting" ? (
            <BankActionFooter>
              <BankActionSecondaryButton
                disabled={pending}
                onClick={() => {
                  setPhase("details");
                  setError(null);
                }}
              >
                Back
              </BankActionSecondaryButton>
              <BankActionPrimaryButton
                loading={pending}
                onClick={() => void submit()}
              >
                {isEditing ? "Save employee" : "Add employee"}
              </BankActionPrimaryButton>
            </BankActionFooter>
          ) : (
            <BankActionFooter>
              <BankActionSecondaryButton disabled={pending} onClick={() => setOpen(false)}>
                Cancel
              </BankActionSecondaryButton>
              <BankActionPrimaryButton
                disabled={pending}
                onClick={() => {
                  const validationError = validateDraft();
                  if (validationError) {
                    setError(validationError);
                    return;
                  }
                  setError(null);
                  setPhase("review");
                }}
              >
                Review
              </BankActionPrimaryButton>
            </BankActionFooter>
          )
        }
      >
        {phase === "success" ? (
          <p className="text-sm text-muted-foreground">
            {isEditing ? "Employee updated." : "Employee added to the registry."}
          </p>
        ) : phase === "review" || phase === "submitting" ? (
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-medium text-right">{draft.displayName.trim()}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Deposit account</dt>
              <dd className="font-mono text-[12px] text-right">{draft.accountNumber.trim()}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Pay</dt>
              <dd className="tabular-nums text-right">{florin(Number(draft.payAmount))}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Schedule</dt>
              <dd className="text-right capitalize">
                {draft.payFrequency} · {payDayLabel}
              </dd>
            </div>
            <p className="pt-2 text-[12px] text-muted-foreground">
              Salary is sent automatically at 9:00 AM Eastern on the chosen schedule.
            </p>
          </dl>
        ) : (
          <div className="space-y-4">
            <label className="block text-sm">
              Name
              <input
                className={fieldClass}
                value={draft.displayName}
                onChange={(e) => setDraft((prev) => ({ ...prev, displayName: e.target.value }))}
                required
              />
            </label>
            <label className="block text-sm">
              Title (optional)
              <input
                className={fieldClass}
                value={draft.title}
                onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              Deposit account
              <input
                className={fieldClass}
                value={draft.accountNumber}
                onChange={(e) => setDraft((prev) => ({ ...prev, accountNumber: e.target.value }))}
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
                value={draft.payAmount}
                onChange={(e) => setDraft((prev) => ({ ...prev, payAmount: e.target.value }))}
                required
              />
            </label>
            <label className="block text-sm">
              Pay frequency
              <select
                className={fieldClass}
                value={draft.payFrequency}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    payFrequency: e.target.value as PaymentFrequencyCode,
                  }))
                }
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
                value={draft.payDay}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, payDay: e.target.value as PayDayCode }))
                }
                required
              >
                {payDayOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        )}
        {phase === "error" && error ? <p className="text-sm text-destructive">{error}</p> : null}
      </ResponsiveBankAction>
    </>
  );
}

function SchedulePayrollSheet({
  company,
  employees,
}: {
  company: BusinessTreasuryCompany;
  employees: PayrollEmployeeRow[];
}) {
  const router = useRouter();
  const createRun = useServerFn(createPayrollRunRecord);

  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<BankActionPhase>("details");
  const [label, setLabel] = useState("");
  const [payDate, setPayDate] = useState("");
  const [memo, setMemo] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const selectedEmployees = employees.filter((employee) => selectedIds.includes(employee.id));
  const totalAmount = selectedEmployees.reduce((sum, employee) => sum + employee.payAmount, 0);
  const dirty =
    phase === "review" ||
    phase === "submitting" ||
    label.trim().length > 0 ||
    selectedIds.length > 0 ||
    Boolean(payDate);

  useEffect(() => {
    if (!open) return;
    setPhase("details");
    setLabel("");
    setPayDate("");
    setMemo("");
    setSelectedIds(employees.map((employee) => employee.id));
    setError(null);
    setPending(false);
  }, [open, employees]);

  function validate(): string | null {
    if (!label.trim()) return "Batch label is required.";
    if (!payDate) return "Pay date is required.";
    if (selectedIds.length === 0) return "Select at least one employee.";
    return null;
  }

  async function submit() {
    setPending(true);
    setPhase("submitting");
    setError(null);
    try {
      await createRun({
        data: {
          companyId: company.companyId,
          bankAccountId: company.operatingAccount.id,
          label: label.trim(),
          payDate,
          employeeIds: selectedIds,
          memo: memo.trim() || undefined,
        },
      });
      setPhase("success");
      await router.invalidate();
    } catch (err) {
      setPhase("error");
      setError(
        err instanceof Error
          ? err.message.replace(/^BAD_REQUEST:/, "")
          : "Failed to schedule payroll.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={employees.length === 0}
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium transition-colors hover:bg-surface-2/60 disabled:opacity-50"
      >
        Schedule payroll
      </button>
      <ResponsiveBankAction
        open={open}
        onOpenChange={setOpen}
        title="Schedule payroll"
        description="Review the batch before it is approved for automatic execution on the pay date."
        phase={phase}
        dirty={dirty}
        size="lg"
        showBack={phase === "review" || phase === "error"}
        onBack={() => {
          setPhase("details");
          setError(null);
        }}
        footer={
          phase === "success" ? (
            <BankActionFooter>
              <BankActionPrimaryButton onClick={() => setOpen(false)}>Done</BankActionPrimaryButton>
            </BankActionFooter>
          ) : phase === "review" || phase === "submitting" ? (
            <BankActionFooter>
              <BankActionSecondaryButton
                disabled={pending}
                onClick={() => {
                  setPhase("details");
                  setError(null);
                }}
              >
                Back
              </BankActionSecondaryButton>
              <BankActionPrimaryButton loading={pending} onClick={() => void submit()}>
                Confirm & schedule
              </BankActionPrimaryButton>
            </BankActionFooter>
          ) : (
            <BankActionFooter>
              <BankActionSecondaryButton disabled={pending} onClick={() => setOpen(false)}>
                Cancel
              </BankActionSecondaryButton>
              <BankActionPrimaryButton
                disabled={pending || employees.length === 0}
                onClick={() => {
                  const validationError = validate();
                  if (validationError) {
                    setError(validationError);
                    return;
                  }
                  setError(null);
                  setPhase("review");
                }}
              >
                Review
              </BankActionPrimaryButton>
            </BankActionFooter>
          )
        }
      >
        {phase === "success" ? (
          <p className="text-sm text-muted-foreground">
            Payroll batch scheduled. It will run automatically on the pay date.
          </p>
        ) : phase === "review" || phase === "submitting" ? (
          <div className="space-y-4 text-sm">
            <dl className="space-y-3">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Label</dt>
                <dd className="font-medium text-right">{label.trim()}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Pay date</dt>
                <dd className="text-right">{payDate}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Employees</dt>
                <dd className="text-right">{selectedEmployees.length}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Total</dt>
                <dd className="tabular-nums font-medium text-right">{florin(totalAmount)}</dd>
              </div>
            </dl>
            <ul className="divide-y divide-border rounded-md border border-border">
              {selectedEmployees.map((employee) => (
                <li key={employee.id} className="flex justify-between gap-3 px-3 py-2">
                  <span>{employee.displayName}</span>
                  <span className="tabular-nums">{florin(employee.payAmount)}</span>
                </li>
              ))}
            </ul>
            <p className="text-[12px] text-muted-foreground">
              Confirming schedules this batch for automatic execution. Funds leave the Business
              Operating Account on the pay date.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block text-sm">
              Batch label
              <input
                className={fieldClass}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="March salaries"
                required
              />
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
            <label className="block text-sm">
              Memo (optional)
              <input
                className={fieldClass}
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
              />
            </label>
            <fieldset>
              <legend className="text-sm">Employees</legend>
              <div className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-md border border-border p-3">
                {employees.length === 0 ? (
                  <p className="text-[13px] text-muted-foreground">No active employees.</p>
                ) : (
                  employees.map((employee) => {
                    const checked = selectedIds.includes(employee.id);
                    return (
                      <label key={employee.id} className="flex min-h-11 items-center gap-3 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedIds((current) =>
                              checked
                                ? current.filter((id) => id !== employee.id)
                                : [...current, employee.id],
                            );
                          }}
                          className="size-4"
                        />
                        <span className="flex-1">{employee.displayName}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {florin(employee.payAmount)}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </fieldset>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        )}
        {phase === "error" && error ? <p className="text-sm text-destructive">{error}</p> : null}
      </ResponsiveBankAction>
    </>
  );
}

function PayrollHistoryList({ runs }: { runs: PayrollRunRow[] }) {
  if (runs.length === 0) {
    return (
      <p className="px-5 py-8 text-[13px] text-muted-foreground sm:px-6">No payroll batches yet.</p>
    );
  }

  return (
    <div className="divide-y divide-border">
      {runs.map((run) => (
        <div key={run.id} className="px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="font-medium">{run.label}</div>
            <div className="font-mono text-sm tabular-nums">{florin(run.totalAmount)}</div>
          </div>
          <div className="mt-1 flex flex-wrap gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <span>{run.statusLabel}</span>
            <span>Pay date {formatDueDate(run.payDate)}</span>
            <span>
              {run.lineItems.length} employee{run.lineItems.length === 1 ? "" : "s"}
            </span>
          </div>
          {run.lastFailureReason && run.status !== "executed" ? (
            <p className="mt-2 text-[12px] text-destructive">{run.lastFailureReason}</p>
          ) : null}
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {run.lineItems.map((line) => (
              <li key={line.employeeId} className="flex justify-between gap-4">
                <span>{line.displayName}</span>
                <span className="type-finance-nums">{florin(line.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
