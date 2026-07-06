"use client";

import { useRouter } from "@tanstack/react-router";
import { SUBMITTING_COPY } from "@/lib/ui/route-loading";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/page-shell";
import { AltaPayForm } from "@/components/bank/alta-pay-form";
import { AltaPayHistoryTable } from "@/components/bank/alta-pay-received-panel";
import {
  parsePayFundingKey,
  payFundingLabel,
  resolvePayFundingKey,
  selfPayBlockedCompanyIdForFunding,
} from "@/components/bank/alta-pay-form";
import { florin } from "@/lib/bank/api";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";
import type { AltaPayPaymentRow, PayFundingSourceOption } from "@/lib/bank/alta-pay-types";
import type {
  AltaPayScheduleRow,
  MerchantAutopayApprovalRow,
} from "@/lib/bank/payments-engine-types";
import {
  cancelAltaPayScheduleFn,
  cancelMerchantAutopayApprovalFn,
  createAltaPayScheduleFn,
  createMerchantAutopayApprovalFn,
  pauseAltaPayScheduleFn,
  pauseMerchantAutopayApprovalFn,
  resumeAltaPayScheduleFn,
} from "@/lib/bank/payments-engine.functions";
import { searchPayableCompaniesForPay, searchPayableRecipientsForPay } from "@/lib/bank/alta-pay.functions";
import type { PayableRecipient } from "@/lib/bank/alta-pay-types";

type EngineTab = "now" | "scheduled" | "recurring" | "autopay";

export type AltaPayEngineTab = EngineTab;

const inputClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40";

const ALTA_PAY_SELF_COMPANY_BLOCKED = "Companies cannot send Alta Pay to themselves.";

function ScheduleList({
  schedules,
  onPause,
  onResume,
  onCancel,
}: {
  schedules: AltaPayScheduleRow[];
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const filtered = schedules;
  if (filtered.length === 0) {
    return <p className="text-[13px] text-muted-foreground">No payments yet.</p>;
  }
  return (
    <div className="divide-y divide-border rounded-md border border-border">
      {filtered.map((row) => (
        <div key={row.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm">
          <div>
            <p className="font-medium">{row.payeeLabel}</p>
            <p className="text-[12px] text-muted-foreground">
              {row.paymentTypeLabel} · {row.statusLabel} · {florin(row.amount)}
            </p>
            <p className="text-[12px] text-muted-foreground">
              {row.nextRunDate
                ? `Next: ${formatActivityDateTime(row.nextRunDate)}`
                : row.scheduledDate
                  ? `Runs: ${formatActivityDateTime(row.scheduledDate)}`
                  : null}
            </p>
            {row.lastFailureReason ? (
              <p className="mt-1 text-[12px] text-destructive">{row.lastFailureReason}</p>
            ) : null}
          </div>
          <div className="flex gap-2">
            {row.status === "approved" && row.paymentType === "recurring" ? (
              <button type="button" className="text-[12px] text-muted-foreground hover:text-foreground" onClick={() => onPause(row.id)}>
                Pause
              </button>
            ) : null}
            {row.status === "paused" ? (
              <button type="button" className="text-[12px] text-muted-foreground hover:text-foreground" onClick={() => onResume(row.id)}>
                Resume
              </button>
            ) : null}
            {row.status === "approved" || row.status === "paused" ? (
              <button type="button" className="text-[12px] text-muted-foreground hover:text-foreground" onClick={() => onCancel(row.id)}>
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function AutopayList({
  approvals,
  onPause,
  onCancel,
}: {
  approvals: MerchantAutopayApprovalRow[];
  onPause: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  if (approvals.length === 0) {
    return <p className="text-[13px] text-muted-foreground">No approved merchants yet.</p>;
  }
  return (
    <div className="divide-y divide-border rounded-md border border-border">
      {approvals.map((row) => (
        <div key={row.id} className="px-4 py-3 text-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium">{row.merchantName}</p>
              <p className="text-[12px] text-muted-foreground">{row.fundingAccountLabel}</p>
            </div>
            <span className="text-[12px] text-muted-foreground">{row.statusLabel}</span>
          </div>
          <dl className="mt-2 grid gap-1 text-[12px] text-muted-foreground sm:grid-cols-2">
            <div>Max invoice: {florin(row.maxInvoiceAmount)}</div>
            <div>
              Confirm above:{" "}
              {row.confirmationRequiredAboveAmount != null
                ? florin(row.confirmationRequiredAboveAmount)
                : "—"}
            </div>
            <div>Frequency: {row.allowedFrequencyLabel}</div>
            <div>Max/month: {row.maxPaymentsPerMonth}</div>
            <div>Recurring invoices: {row.allowRecurringInvoices ? "Allowed" : "Blocked"}</div>
          </dl>
          <div className="mt-2 flex gap-2">
            {row.status === "active" ? (
              <button type="button" className="text-[12px] text-muted-foreground hover:text-foreground" onClick={() => onPause(row.id)}>
                Pause
              </button>
            ) : null}
            {row.status !== "cancelled" ? (
              <button type="button" className="text-[12px] text-muted-foreground hover:text-foreground" onClick={() => onCancel(row.id)}>
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScheduleForm({
  fundingSources,
  defaultFundingKey,
  paymentType,
  onCreated,
}: {
  fundingSources: PayFundingSourceOption[];
  defaultFundingKey?: string;
  paymentType: "scheduled" | "recurring";
  onCreated: () => void;
}) {
  const createSchedule = useServerFn(createAltaPayScheduleFn);
  const searchRecipients = useServerFn(searchPayableRecipientsForPay);
  const [query, setQuery] = useState("");
  const [recipients, setRecipients] = useState<PayableRecipient[]>([]);
  const [selected, setSelected] = useState<PayableRecipient | null>(null);
  const [amount, setAmount] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [frequency, setFrequency] = useState<"weekly" | "monthly" | "quarterly" | "yearly">("monthly");
  const [memo, setMemo] = useState("");
  const [fundingKey, setFundingKey] = useState(() => resolvePayFundingKey(fundingSources, defaultFundingKey));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSearch(value: string) {
    setQuery(value);
    if (value.trim().length < 1) {
      setRecipients([]);
      return;
    }
    const results = await searchRecipients({ data: value });
    setRecipients(results);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || submitting) return;
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    if (selected.kind === "person" && fundingKey.startsWith("alta_card:")) {
      setError("Scheduled Alta Card payments can only be sent to verified companies.");
      return;
    }
    const selectedFunding = availableFundingSources.find(
      (source) => `${source.kind}:${source.id}` === fundingKey,
    );
    const blockedSelfPayCompanyId = selfPayBlockedCompanyIdForFunding(selectedFunding);
    if (
      selected.kind === "company" &&
      blockedSelfPayCompanyId &&
      selected.id === blockedSelfPayCompanyId
    ) {
      setError(ALTA_PAY_SELF_COMPANY_BLOCKED);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createSchedule({
        data: {
          fundingSource: parsePayFundingKey(fundingKey),
          paymentType,
          payeeLabel: selected.name,
          recipientCompanyId: selected.kind === "company" ? selected.id : undefined,
          recipientUserId: selected.kind === "person" ? selected.id : undefined,
          amount: parsedAmount,
          scheduledDate,
          frequency: paymentType === "recurring" ? frequency : undefined,
          memo: memo.trim() || undefined,
        },
      });
      onCreated();
    } catch (err) {
      setError(formatCustomerActionError(err));
    } finally {
      setSubmitting(false);
    }
  }

  const availableFundingSources =
    selected?.kind === "person"
      ? fundingSources.filter((source) => source.kind === "bank_account")
      : fundingSources;
  const selectedFunding = availableFundingSources.find(
    (source) => `${source.kind}:${source.id}` === fundingKey,
  );
  const blockedSelfPayCompanyId = selfPayBlockedCompanyIdForFunding(selectedFunding);
  const payableRecipients =
    selected?.kind === "company" && blockedSelfPayCompanyId
      ? recipients.filter(
          (recipient) =>
            recipient.kind !== "company" || recipient.id !== blockedSelfPayCompanyId,
        )
      : recipients;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="type-meta">Payee</span>
        <input className={inputClass} value={query} onChange={(e) => void handleSearch(e.target.value)} placeholder="Search company or person" />
        {payableRecipients.length > 0 && !selected ? (
          <ul className="mt-2 max-h-40 overflow-auto rounded-md border border-border">
            {payableRecipients.map((r) => (
              <li key={`${r.kind}:${r.id}`}>
                <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-muted/40" onClick={() => {
                  setSelected(r);
                  setQuery(r.name);
                  setRecipients([]);
                  if (r.kind === "person" && fundingKey.startsWith("alta_card:")) {
                    const firstBank = fundingSources.find((source) => source.kind === "bank_account");
                    if (firstBank) setFundingKey(`${firstBank.kind}:${firstBank.id}`);
                  }
                }}>
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </label>
      <label className="block">
        <span className="type-meta">Funding source</span>
        <select className={inputClass} value={fundingKey} onChange={(e) => setFundingKey(e.target.value)}>
          {availableFundingSources.map((s) => (
            <option key={`${s.kind}:${s.id}`} value={`${s.kind}:${s.id}`}>
              {payFundingLabel(s)}
            </option>
          ))}
        </select>
        {selected?.kind === "person" ? (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Alta Card is available for company payees only.
          </p>
        ) : null}
      </label>
      <label className="block">
        <span className="type-meta">Amount</span>
        <input className={inputClass} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
      </label>
      <label className="block">
        <span className="type-meta">{paymentType === "recurring" ? "First run date" : "Payment date"}</span>
        <input className={inputClass} type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
      </label>
      {paymentType === "recurring" ? (
        <label className="block">
          <span className="type-meta">Frequency</span>
          <select className={inputClass} value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="yearly">Yearly</option>
          </select>
        </label>
      ) : null}
      <label className="block">
        <span className="type-meta">Memo (optional)</span>
        <input className={inputClass} value={memo} onChange={(e) => setMemo(e.target.value)} />
      </label>
      {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
      <button type="submit" disabled={submitting || !selected} className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
        {submitting ? SUBMITTING_COPY.saving : paymentType === "recurring" ? "Create recurring payment" : "Schedule payment"}
      </button>
    </form>
  );
}

function AutopayForm({
  fundingSources,
  defaultFundingKey,
  onCreated,
}: {
  fundingSources: PayFundingSourceOption[];
  defaultFundingKey?: string;
  onCreated: () => void;
}) {
  const createApproval = useServerFn(createMerchantAutopayApprovalFn);
  const searchCompanies = useServerFn(searchPayableCompaniesForPay);
  const [query, setQuery] = useState("");
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [merchantCompanyId, setMerchantCompanyId] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [maxInvoiceAmount, setMaxInvoiceAmount] = useState("50000");
  const [confirmAbove, setConfirmAbove] = useState("20000");
  const [maxPaymentsPerMonth, setMaxPaymentsPerMonth] = useState("10");
  const [fundingKey, setFundingKey] = useState(() => resolvePayFundingKey(fundingSources, defaultFundingKey));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSearch(value: string) {
    setQuery(value);
    if (value.trim().length < 1) {
      setCompanies([]);
      return;
    }
    const results = await searchCompanies({ data: value });
    setCompanies(results.map((c) => ({ id: c.id, name: c.name })));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!merchantCompanyId || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await createApproval({
        data: {
          merchantCompanyId,
          fundingSource: parsePayFundingKey(fundingKey),
          maxInvoiceAmount: Number(maxInvoiceAmount),
          confirmationRequiredAboveAmount: Number(confirmAbove),
          allowedFrequency: "monthly",
          maxPaymentsPerMonth: Number(maxPaymentsPerMonth) || 1,
          allowRecurringInvoices: true,
        },
      });
      onCreated();
    } catch (err) {
      setError(formatCustomerActionError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="type-meta">Merchant</span>
        <input className={inputClass} value={query} onChange={(e) => void handleSearch(e.target.value)} placeholder="Search verified company" />
        {companies.length > 0 && !merchantCompanyId ? (
          <ul className="mt-2 max-h-40 overflow-auto rounded-md border border-border">
            {companies.map((c) => (
              <li key={c.id}>
                <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-muted/40" onClick={() => { setMerchantCompanyId(c.id); setMerchantName(c.name); setQuery(c.name); setCompanies([]); }}>
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {merchantName ? <p className="mt-1 text-[12px] text-muted-foreground">Selected: {merchantName}</p> : null}
      </label>
      <label className="block">
        <span className="type-meta">Funding source</span>
        <select className={inputClass} value={fundingKey} onChange={(e) => setFundingKey(e.target.value)}>
          {fundingSources.map((s) => (
            <option key={`${s.kind}:${s.id}`} value={`${s.kind}:${s.id}`}>
              {payFundingLabel(s)}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="type-meta">Maximum invoice</span>
          <input className={inputClass} value={maxInvoiceAmount} onChange={(e) => setMaxInvoiceAmount(e.target.value)} />
        </label>
        <label className="block">
          <span className="type-meta">Require confirmation above</span>
          <input className={inputClass} value={confirmAbove} onChange={(e) => setConfirmAbove(e.target.value)} />
        </label>
        <label className="block">
          <span className="type-meta">Max AutoPay per month</span>
          <input
            className={inputClass}
            type="number"
            min="1"
            step="1"
            value={maxPaymentsPerMonth}
            onChange={(e) => setMaxPaymentsPerMonth(e.target.value)}
          />
        </label>
      </div>
      {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
      <button type="submit" disabled={submitting || !merchantCompanyId} className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50">
        {submitting ? SUBMITTING_COPY.saving : "Approve merchant"}
      </button>
    </form>
  );
}

export function AltaPayEnginePanel({
  tab = "now",
  fundingSources,
  defaultFundingKey,
  history,
  schedules,
  autopayApprovals,
}: {
  tab?: EngineTab;
  fundingSources: PayFundingSourceOption[];
  defaultFundingKey?: string;
  history: AltaPayPaymentRow[];
  schedules: AltaPayScheduleRow[];
  autopayApprovals: MerchantAutopayApprovalRow[];
}) {
  const router = useRouter();

  const pauseSchedule = useServerFn(pauseAltaPayScheduleFn);
  const resumeSchedule = useServerFn(resumeAltaPayScheduleFn);
  const cancelSchedule = useServerFn(cancelAltaPayScheduleFn);
  const pauseAutopay = useServerFn(pauseMerchantAutopayApprovalFn);
  const cancelAutopay = useServerFn(cancelMerchantAutopayApprovalFn);

  async function refresh() {
    await router.invalidate();
  }

  return (
    <div className="space-y-8">
      {tab === "now" ? (
        <AltaPayForm fundingSources={fundingSources} defaultFundingKey={defaultFundingKey} onSuccess={refresh} />
      ) : null}

      {tab === "scheduled" ? (
        <div className="grid gap-8 lg:grid-cols-2">
          <Card className="!p-6">
            <h3 className="text-sm font-medium">Schedule a payment</h3>
            <div className="mt-4">
              <ScheduleForm
                fundingSources={fundingSources}
                defaultFundingKey={defaultFundingKey}
                paymentType="scheduled"
                onCreated={refresh}
              />
            </div>
          </Card>
          <Card className="!p-6">
            <h3 className="text-sm font-medium">Scheduled payments</h3>
            <div className="mt-4">
              <ScheduleList
                schedules={schedules.filter((s) => s.paymentType === "scheduled")}
                onPause={(id) => void pauseSchedule({ data: id }).then(refresh)}
                onResume={(id) => void resumeSchedule({ data: id }).then(refresh)}
                onCancel={(id) => void cancelSchedule({ data: id }).then(refresh)}
              />
            </div>
          </Card>
        </div>
      ) : null}

      {tab === "recurring" ? (
        <div className="grid gap-8 lg:grid-cols-2">
          <Card className="!p-6">
            <h3 className="text-sm font-medium">Create recurring payment</h3>
            <div className="mt-4">
              <ScheduleForm
                fundingSources={fundingSources}
                defaultFundingKey={defaultFundingKey}
                paymentType="recurring"
                onCreated={refresh}
              />
            </div>
          </Card>
          <Card className="!p-6">
            <h3 className="text-sm font-medium">Recurring payments</h3>
            <div className="mt-4">
              <ScheduleList
                schedules={schedules.filter((s) => s.paymentType === "recurring")}
                onPause={(id) => void pauseSchedule({ data: id }).then(refresh)}
                onResume={(id) => void resumeSchedule({ data: id }).then(refresh)}
                onCancel={(id) => void cancelSchedule({ data: id }).then(refresh)}
              />
            </div>
          </Card>
        </div>
      ) : null}

      {tab === "autopay" ? (
        <div className="grid gap-8 lg:grid-cols-2">
          <Card className="!p-6">
            <h3 className="text-sm font-medium">Approve merchant AutoPay</h3>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Approve a verified merchant to automatically pay future invoices from a specific funding account.
            </p>
            <div className="mt-4">
              <AutopayForm fundingSources={fundingSources} defaultFundingKey={defaultFundingKey} onCreated={refresh} />
            </div>
          </Card>
          <Card className="!p-6">
            <h3 className="text-sm font-medium">Approved merchants</h3>
            <div className="mt-4">
              <AutopayList
                approvals={autopayApprovals}
                onPause={(id) => void pauseAutopay({ data: id }).then(refresh)}
                onCancel={(id) => void cancelAutopay({ data: id }).then(refresh)}
              />
            </div>
          </Card>
        </div>
      ) : null}

      <Card className="!p-6">
        <h3 className="text-sm font-medium">Recent payments</h3>
        <div className="mt-4">
          <AltaPayHistoryTable payments={history} />
        </div>
      </Card>
    </div>
  );
}
