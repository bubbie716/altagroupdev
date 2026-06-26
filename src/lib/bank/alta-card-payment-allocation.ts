import { roundMoney } from "@/lib/bank/alta-card-minimum-payment";

export type StatementPaymentBuckets = {
  feesCharged: number;
  interestCharged: number;
  statementBalance: number;
  feesPaid: number;
  interestPaid: number;
  principalPaid: number;
};

export type PaymentBucketAllocation = {
  toFees: number;
  toInterest: number;
  toPrincipal: number;
  totalApplied: number;
};

export function calculateBucketAmountsOwed(buckets: StatementPaymentBuckets): {
  feesOwed: number;
  interestOwed: number;
  principalOwed: number;
} {
  const feesOwed = roundMoney(Math.max(0, buckets.feesCharged - buckets.feesPaid));
  const interestOwed = roundMoney(Math.max(0, buckets.interestCharged - buckets.interestPaid));
  const principalOwed = roundMoney(
    Math.max(
      0,
      buckets.statementBalance - buckets.feesCharged - buckets.interestCharged - buckets.principalPaid,
    ),
  );
  return { feesOwed, interestOwed, principalOwed };
}

/**
 * Apply payment to a statement in priority order: fees → interest → principal.
 */
export function allocatePaymentToBuckets(
  paymentAmount: number,
  buckets: StatementPaymentBuckets,
): PaymentBucketAllocation {
  if (paymentAmount <= 0) {
    return { toFees: 0, toInterest: 0, toPrincipal: 0, totalApplied: 0 };
  }

  const { feesOwed, interestOwed, principalOwed } = calculateBucketAmountsOwed(buckets);
  let remaining = paymentAmount;

  const toFees = roundMoney(Math.min(remaining, feesOwed));
  remaining = roundMoney(remaining - toFees);

  const toInterest = roundMoney(Math.min(remaining, interestOwed));
  remaining = roundMoney(remaining - toInterest);

  const toPrincipal = roundMoney(Math.min(remaining, principalOwed));

  return {
    toFees,
    toInterest,
    toPrincipal,
    totalApplied: roundMoney(toFees + toInterest + toPrincipal),
  };
}
