import { useState } from "react";
import type { AltaCardStatusCode, AltaCardTierCode } from "@/lib/bank/alta-card-types";
import {
  ALTA_CARD_TIER_LABELS,
  altaCardStatusLabel,
  formatAltaCardCurrency,
  formatAltaCardRate,
} from "@/lib/bank/alta-card-types";
import { ALTA_CARD_TIER_CONFIG } from "@/lib/bank/alta-card-tier-config";
import type { InternalAltaCardOperationsContext } from "@/lib/bank/alta-card-types";
import { BankReviewButton } from "@/components/bank/bank-review-button";
import { isAdmin } from "@/lib/auth/permissions";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  applyAdminManualFeeRecord,
  changeAltaCardStatusRecord,
  changeAltaCardTierAdminRecord,
  createAdminAltaCardAdjustmentWithAuditRecord,
  submitAdminManualCardPaymentRecord,
  updateAltaCardLimitAdminRecord,
  updateAltaCardRateAdminRecord,
} from "@/lib/bank/alta-card-admin.functions";
import {
  closeEmployeeCardRecord,
  freezeEmployeeCardRecord,
  updateEmployeeCardLimitRecord,
} from "@/lib/bank/alta-card.functions";
import { unfreezeEmployeeCardRecord } from "@/lib/bank/alta-card-admin.functions";
import { AltaCardTransactionHistory } from "@/components/bank/alta-card/alta-card-transaction-history";
import { AltaCardEmployeeCardCreateForm } from "@/components/bank/alta-card/alta-card-employee-card-create-form";

function ReasonField({
  value,
  onChange,
  placeholder = "Reason (required)",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded border border-border bg-surface-1 px-2 py-1 text-[13px]"
    />
  );
}

export function InternalAltaCardOpsPanel({
  ops,
  onRefresh,
}: {
  ops: InternalAltaCardOperationsContext;
  onRefresh: () => Promise<void>;
}) {
  const user = useCurrentUser();
  const admin = user ? isAdmin(user) : false;
  const { card, utilization, lastPayment, lastTransaction, relationship, tierDefaultLimit, tierDefaultRate, employeeMemberOptions } =
    ops;

  const [actionReason, setActionReason] = useState("");
  const [adminOverride, setAdminOverride] = useState(false);
  const [limit, setLimit] = useState(String(card.creditLimit));
  const [rate, setRate] = useState(String(card.interestRate));
  const [tier, setTier] = useState(card.tier);
  const [applyTierDefaults, setApplyTierDefaults] = useState(false);
  const [goldOverride, setGoldOverride] = useState(false);
  const [manualPaymentAmount, setManualPaymentAmount] = useState("");
  const [manualFeeAmount, setManualFeeAmount] = useState("");
  const [adjKind, setAdjKind] = useState<"credit" | "debit">("credit");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [empEditLimit, setEmpEditLimit] = useState<Record<string, string>>({});

  async function runStatusChange(status: AltaCardStatusCode) {
    if (!actionReason.trim()) return;
    await changeAltaCardStatusRecord({
      data: { cardId: card.id, status, reason: actionReason.trim(), adminOverride },
    });
    setActionReason("");
    await onRefresh();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="mx-auto w-full max-w-[280px] shrink-0 lg:mx-0">
          <AltaCardVisual
            tier={card.tier}
            cardLastFour={card.cardLastFour}
            cardHolder={card.ownerUsername ?? card.companyName ?? "Cardholder"}
            compact
            width={280}
          />
        </div>
        <div className="flex-1 rounded-xl border border-border bg-surface-1/80 p-5">
          <h3 className="font-serif text-[18px]">Card overview</h3>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Cardholder
            </dt>
            <dd className="mt-1 text-[13px]">{card.ownerUsername ?? "—"}</dd>
          </div>
          {card.companyName ? (
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Company
              </dt>
              <dd className="mt-1 text-[13px]">{card.companyName}</dd>
            </div>
          ) : null}
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Type / tier
            </dt>
            <dd className="mt-1 text-[13px]">
              {card.cardType} · {ALTA_CARD_TIER_LABELS[card.tier]}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Status
            </dt>
            <dd className="mt-1 text-[13px]">{altaCardStatusLabel(card.status)}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Credit limit
            </dt>
            <dd className="mt-1 font-mono tabular-nums">{formatAltaCardCurrency(card.creditLimit)}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Available
            </dt>
            <dd className="mt-1 font-mono tabular-nums">
              {formatAltaCardCurrency(card.availableCredit)}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Balance
            </dt>
            <dd className="mt-1 font-mono tabular-nums">
              {formatAltaCardCurrency(card.currentBalance)}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Utilization
            </dt>
            <dd className="mt-1 font-mono tabular-nums">{utilization.toFixed(1)}%</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Statement balance
            </dt>
            <dd className="mt-1 font-mono tabular-nums">
              {formatAltaCardCurrency(card.statementBalance)}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Minimum payment
            </dt>
            <dd className="mt-1 font-mono tabular-nums">
              {formatAltaCardCurrency(card.minimumPaymentDue)}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Due date
            </dt>
            <dd className="mt-1 text-[13px]">
              {card.dueDate ? new Date(card.dueDate).toLocaleDateString() : "—"}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Interest rate
            </dt>
            <dd className="mt-1 font-mono tabular-nums">
              {formatAltaCardRate(card.interestRate)}
              {tierDefaultRate != null ? (
                <span className="ml-2 text-[11px] text-muted-foreground">
                  (tier default {formatAltaCardRate(tierDefaultRate)})
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Opened
            </dt>
            <dd className="mt-1 text-[13px]">
              {card.openedAt ? new Date(card.openedAt).toLocaleDateString() : "—"}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Last payment
            </dt>
            <dd className="mt-1 text-[13px]">
              {lastPayment
                ? `${formatAltaCardCurrency(lastPayment.amount)} · ${new Date(lastPayment.createdAt).toLocaleDateString()}`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Last transaction
            </dt>
            <dd className="mt-1 text-[13px]">
              {lastTransaction
                ? `${lastTransaction.type} · ${formatAltaCardCurrency(lastTransaction.amount)}`
                : "—"}
            </dd>
          </div>
        </dl>
        </div>
      </div>

      <section className="rounded-xl border border-gold/30 bg-gold/5 p-5">
        <h3 className="font-serif text-[18px]">Relationship pricing recommendation</h3>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Recommendation only — does not auto-approve. Score: {relationship.relationshipScore}/100
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Recommended tier
            </dt>
            <dd className="mt-1">{ALTA_CARD_TIER_LABELS[relationship.recommendedTier]}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Recommended limit
            </dt>
            <dd className="mt-1 font-mono tabular-nums">
              {formatAltaCardCurrency(relationship.recommendedCreditLimit)}
            </dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Recommended rate
            </dt>
            <dd className="mt-1 font-mono tabular-nums">
              {formatAltaCardRate(relationship.recommendedInterestRate)}
            </dd>
          </div>
        </dl>
        <ul className="mt-4 space-y-1 text-[12px]">
          {relationship.relationshipFactors.map((f) => (
            <li key={f.key} className="flex justify-between gap-4">
              <span>
                {f.label}: {f.value}
              </span>
              <span className="font-mono text-muted-foreground">
                {f.impact >= 0 ? "+" : ""}
                {f.impact}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <BankReviewButton
            label="Apply recommendation to terms"
            variant="primary"
            onAction={async () => {
              await updateAltaCardLimitAdminRecord({
                data: {
                  cardId: card.id,
                  creditLimit: relationship.recommendedCreditLimit,
                  reason: "Apply relationship pricing recommendation",
                },
              });
              await updateAltaCardRateAdminRecord({
                data: {
                  cardId: card.id,
                  interestRate: relationship.recommendedInterestRate,
                  reason: "Apply relationship pricing recommendation",
                },
              });
              await changeAltaCardTierAdminRecord({
                data: {
                  cardId: card.id,
                  tier: relationship.recommendedTier,
                  reason: "Apply relationship pricing recommendation",
                },
              });
              setLimit(String(relationship.recommendedCreditLimit));
              setRate(String(relationship.recommendedInterestRate));
              setTier(relationship.recommendedTier);
              await onRefresh();
            }}
          />
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-surface-1/80 p-5">
        <h3 className="font-serif text-[18px]">Status controls</h3>
        <ReasonField value={actionReason} onChange={setActionReason} />
        {admin ? (
          <label className="flex items-center gap-2 text-[12px]">
            <input
              type="checkbox"
              checked={adminOverride}
              onChange={(e) => setAdminOverride(e.target.checked)}
            />
            Admin override (e.g. reopen closed card)
          </label>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {card.status === "pending" ? (
            <BankReviewButton
              label="Activate"
              variant="primary"
              onAction={() => runStatusChange("active")}
            />
          ) : null}
          {card.status === "active" ? (
            <>
              <BankReviewButton label="Freeze" onAction={() => runStatusChange("frozen")} />
              <BankReviewButton label="Mark lost" onAction={() => runStatusChange("lost")} />
              <BankReviewButton
                label="Mark delinquent"
                onAction={() => runStatusChange("delinquent")}
              />
              <BankReviewButton
                label="Close"
                variant="danger"
                onAction={() => runStatusChange("closed")}
              />
            </>
          ) : null}
          {card.status === "frozen" || card.status === "delinquent" ? (
            <BankReviewButton
              label="Restore active"
              variant="primary"
              onAction={() => runStatusChange("active")}
            />
          ) : null}
          {card.status === "lost" ? (
            <BankReviewButton
              label="Close (lost)"
              variant="danger"
              onAction={() => runStatusChange("closed")}
            />
          ) : null}
          {card.status === "closed" && admin ? (
            <BankReviewButton
              label="Reopen (admin)"
              variant="primary"
              onAction={async () => {
                setAdminOverride(true);
                await runStatusChange("active");
              }}
            />
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 rounded-xl border border-border bg-surface-1/80 p-5 md:grid-cols-3">
        <div className="space-y-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Credit limit
          </span>
          <input
            type="number"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            className="w-full rounded border border-border bg-surface-1 px-2 py-1 font-mono text-[13px]"
          />
          <ReasonField value={actionReason} onChange={setActionReason} />
          <BankReviewButton
            label="Update limit"
            onAction={async () => {
              await updateAltaCardLimitAdminRecord({
                data: {
                  cardId: card.id,
                  creditLimit: Number(limit),
                  reason: actionReason.trim(),
                  adminOverride,
                },
              });
              await onRefresh();
            }}
          />
        </div>
        <div className="space-y-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Interest rate
          </span>
          <input
            type="number"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="w-full rounded border border-border bg-surface-1 px-2 py-1 font-mono text-[13px]"
          />
          <BankReviewButton
            label="Update rate"
            onAction={async () => {
              await updateAltaCardRateAdminRecord({
                data: {
                  cardId: card.id,
                  interestRate: Number(rate),
                  reason: actionReason.trim() || "Rate change",
                },
              });
              await onRefresh();
            }}
          />
        </div>
        <div className="space-y-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Tier
          </span>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as AltaCardTierCode)}
            className="w-full rounded border border-border bg-surface-1 px-2 py-1 text-[13px]"
          >
            {Object.entries(ALTA_CARD_TIER_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-[12px]">
            <input
              type="checkbox"
              checked={applyTierDefaults}
              onChange={(e) => setApplyTierDefaults(e.target.checked)}
            />
            Apply tier defaults
          </label>
          {tier === "gold" && admin ? (
            <label className="flex items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={goldOverride}
                onChange={(e) => setGoldOverride(e.target.checked)}
              />
              Gold override
            </label>
          ) : null}
          <BankReviewButton
            label="Change tier"
            onAction={async () => {
              await changeAltaCardTierAdminRecord({
                data: {
                  cardId: card.id,
                  tier,
                  reason: actionReason.trim() || "Tier change",
                  applyTierDefaults,
                  goldOverride,
                },
              });
              await onRefresh();
            }}
          />
          <p className="text-[11px] text-muted-foreground">
            {ALTA_CARD_TIER_CONFIG[tier].description}
          </p>
        </div>
      </section>

      <section className="grid gap-4 rounded-xl border border-border bg-surface-1/80 p-5 md:grid-cols-2">
        <div className="space-y-2">
          <h4 className="font-serif text-[16px]">Manual payment</h4>
          <input
            type="number"
            placeholder="Amount"
            value={manualPaymentAmount}
            onChange={(e) => setManualPaymentAmount(e.target.value)}
            className="w-full rounded border border-border px-2 py-1 font-mono text-[13px]"
          />
          <BankReviewButton
            label="Post payment"
            variant="primary"
            onAction={async () => {
              await submitAdminManualCardPaymentRecord({
                data: {
                  cardId: card.id,
                  amount: Number(manualPaymentAmount),
                  reason: actionReason.trim() || "Manual payment",
                },
              });
              setManualPaymentAmount("");
              await onRefresh();
            }}
          />
        </div>
        {admin ? (
          <div className="space-y-2">
            <h4 className="font-serif text-[16px]">Apply fee</h4>
            <input
              type="number"
              placeholder="Fee amount"
              value={manualFeeAmount}
              onChange={(e) => setManualFeeAmount(e.target.value)}
              className="w-full rounded border border-border px-2 py-1 font-mono text-[13px]"
            />
            <BankReviewButton
              label="Apply fee"
              variant="danger"
              onAction={async () => {
                await applyAdminManualFeeRecord({
                  data: {
                    cardId: card.id,
                    amount: Number(manualFeeAmount),
                    reason: actionReason.trim() || "Manual fee",
                  },
                });
                setManualFeeAmount("");
                await onRefresh();
              }}
            />
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-surface-1/80 p-5">
        <h3 className="font-serif text-[18px]">Admin adjustment</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <select
            value={adjKind}
            onChange={(e) => setAdjKind(e.target.value as "credit" | "debit")}
            className="rounded border border-border bg-surface-1 px-2 py-1 text-[13px]"
          >
            <option value="credit">Credit adjustment</option>
            <option value="debit">Debit adjustment</option>
          </select>
          <input
            type="number"
            placeholder="Amount"
            value={adjAmount}
            onChange={(e) => setAdjAmount(e.target.value)}
            className="rounded border border-border bg-surface-1 px-2 py-1 font-mono text-[13px]"
          />
          <ReasonField value={adjReason} onChange={setAdjReason} />
        </div>
        <BankReviewButton
          label="Post adjustment"
          variant="primary"
          onAction={async () => {
            await createAdminAltaCardAdjustmentWithAuditRecord({
              data: {
                cardId: card.id,
                kind: adjKind,
                amount: Number(adjAmount),
                reason: adjReason,
              },
            });
            setAdjAmount("");
            setAdjReason("");
            await onRefresh();
          }}
        />
      </section>

      {card.cardType === "business" ? (
        <section className="space-y-4 rounded-xl border border-border bg-surface-1/80 p-5">
          <h3 className="font-serif text-[18px]">Employee cards</h3>
          {card.employeeCards.map((e) => (
            <div key={e.id} className="rounded border border-border p-4">
              <p className="text-[13px] font-medium">{e.authorizedUsername}</p>
              <p className="text-[12px] text-muted-foreground">
                Limit {formatAltaCardCurrency(e.employeeSpendLimit)} · Spent{" "}
                {formatAltaCardCurrency(e.employeeCurrentBalance)} ·{" "}
                {altaCardStatusLabel(e.status)}
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <input
                  type="number"
                  placeholder="New limit"
                  value={empEditLimit[e.id] ?? String(e.employeeSpendLimit)}
                  onChange={(ev) =>
                    setEmpEditLimit((prev) => ({ ...prev, [e.id]: ev.target.value }))
                  }
                  className="w-28 rounded border border-border px-2 py-1 font-mono text-[12px]"
                />
                <BankReviewButton
                  label="Update limit"
                  onAction={async () => {
                    await updateEmployeeCardLimitRecord({
                      data: {
                        employeeCardId: e.id,
                        employeeSpendLimit: Number(empEditLimit[e.id] ?? e.employeeSpendLimit),
                      },
                    });
                    await onRefresh();
                  }}
                />
                {e.status === "active" ? (
                  <BankReviewButton
                    label="Freeze"
                    onAction={async () => {
                      await freezeEmployeeCardRecord({ data: e.id });
                      await onRefresh();
                    }}
                  />
                ) : null}
                {e.status === "frozen" ? (
                  <BankReviewButton
                    label="Unfreeze"
                    variant="primary"
                    onAction={async () => {
                      await unfreezeEmployeeCardRecord({
                        data: { employeeCardId: e.id, reason: actionReason.trim() || "Unfreeze" },
                      });
                      await onRefresh();
                    }}
                  />
                ) : null}
                {e.status !== "closed" ? (
                  <BankReviewButton
                    label="Close"
                    variant="danger"
                    onAction={async () => {
                      await closeEmployeeCardRecord({ data: e.id });
                      await onRefresh();
                    }}
                  />
                ) : null}
              </div>
              <AltaCardTransactionHistory
                transactions={card.recentTransactions.filter((t) => t.altaEmployeeCardId === e.id)}
                title={`Transactions — ${e.authorizedUsername}`}
              />
            </div>
          ))}
          {card.companyId ? (
            <div className="mt-4 space-y-2 border-t border-border pt-4">
              <h4 className="font-serif text-[16px]">Create employee card</h4>
              <AltaCardEmployeeCardCreateForm
                companyId={card.companyId}
                members={employeeMemberOptions}
                onCreated={onRefresh}
                compact
              />
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
