"use client";

import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/page-shell";
import { florin } from "@/lib/bank/api";
import { formatActivityDateTime } from "@/lib/format-datetime";
import type { CommercialSubscriptionBillingHistory } from "@/lib/bank/commercial-billing-history-types";
import { fetchCommercialSubscriptionBillingHistory } from "@/lib/bank/commercial-banking.functions";
import {
  BankMobileStack,
  BankMobileStackField,
  BankMobileStackRow,
  BankTableScroll,
} from "@/components/bank/bank-scroll-contain";

export function CommercialSubscriptionBillingHistoryPanel({
  companyId,
  canView,
  isPro,
  nextBillingAtHint,
}: {
  companyId: string;
  canView: boolean;
  isPro: boolean;
  nextBillingAtHint?: string | null;
}) {
  const fetchHistory = useServerFn(fetchCommercialSubscriptionBillingHistory);
  const [history, setHistory] = useState<CommercialSubscriptionBillingHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!canView) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchHistory({ data: { companyId } })
      .then((rows) => {
        if (!cancelled) setHistory(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load billing history.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canView, companyId, fetchHistory]);

  if (!canView) return null;

  const nextBillingAt = history?.nextBillingAt ?? nextBillingAtHint ?? null;
  const charges = history?.charges ?? [];

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="border-b border-border px-5 py-4 sm:px-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
          Subscription billing history
        </p>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          Charges to your Commercial Pro billing account. Next billing date
          {nextBillingAt ? (
            <>
              {" "}
              is <span className="text-foreground">{formatActivityDateTime(nextBillingAt)}</span>.
            </>
          ) : (
            " appears here when Pro is active."
          )}
        </p>
      </div>

      {loading ? (
        <p className="px-5 py-8 text-[13px] text-muted-foreground sm:px-6">Loading billing history…</p>
      ) : error ? (
        <p className="px-5 py-8 text-[13px] text-destructive sm:px-6">{error}</p>
      ) : charges.length === 0 ? (
        <p className="px-5 py-8 text-[13px] text-muted-foreground sm:px-6">
          {isPro
            ? "No subscription charges yet. The first charge appears after your Pro purchase or renewal."
            : "No subscription charges on Core. Upgrade to Pro to see purchase and renewal history here."}
        </p>
      ) : (
        <>
          <BankMobileStack>
            {charges.map((charge) => (
              <BankMobileStackRow key={charge.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{charge.chargeTypeLabel}</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {formatActivityDateTime(charge.createdAt)}
                    </p>
                  </div>
                  <p className="shrink-0 font-medium tabular-nums">{florin(charge.amount)}</p>
                </div>
                <BankMobileStackField label="Period">{charge.billingPeriodLabel}</BankMobileStackField>
                <BankMobileStackField label="Status">{charge.statusLabel}</BankMobileStackField>
                <BankMobileStackField label="Billing account">
                  {`${charge.billingAccountName} · ${charge.billingAccountNumber}`}
                </BankMobileStackField>
                {charge.failureReason ? (
                  <BankMobileStackField label="Failure reason">{charge.failureReason}</BankMobileStackField>
                ) : null}
              </BankMobileStackRow>
            ))}
          </BankMobileStack>

          <div className="hidden md:block">
            <BankTableScroll>
              <table className="w-full min-w-[40rem] text-left text-[13px]">
                <thead className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-3 py-3 font-medium">Type</th>
                    <th className="px-3 py-3 font-medium">Period</th>
                    <th className="px-3 py-3 font-medium">Account</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {charges.map((charge) => (
                    <tr key={charge.id}>
                      <td className="px-5 py-3 whitespace-nowrap">
                        {formatActivityDateTime(charge.createdAt)}
                      </td>
                      <td className="px-3 py-3">{charge.chargeTypeLabel}</td>
                      <td className="px-3 py-3">{charge.billingPeriodLabel}</td>
                      <td className="px-3 py-3">
                        <span className="block truncate max-w-[12rem]">
                          {charge.billingAccountName}
                        </span>
                        <span className="block font-mono text-[11px] text-muted-foreground">
                          {charge.billingAccountNumber}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span>{charge.statusLabel}</span>
                        {charge.failureReason ? (
                          <span className="mt-1 block max-w-[14rem] text-[12px] text-muted-foreground">
                            {charge.failureReason}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums font-medium">
                        {florin(charge.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </BankTableScroll>
          </div>
        </>
      )}
    </Card>
  );
}
