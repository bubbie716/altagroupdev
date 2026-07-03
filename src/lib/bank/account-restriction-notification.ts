import type { OperatorCustomerNotificationKind } from "@/lib/bank/customer-operator-notification-copy";

export type AccountRestrictionFlags = {
  restrictDeposits: boolean;
  restrictWithdrawals: boolean;
  restrictTransfers: boolean;
};

export function detectRestrictionNotificationKinds(
  before: AccountRestrictionFlags,
  after: AccountRestrictionFlags,
): OperatorCustomerNotificationKind[] {
  const kinds = new Set<OperatorCustomerNotificationKind>();

  if (!before.restrictWithdrawals && after.restrictWithdrawals) {
    kinds.add("withdrawal_hold_placed");
  }
  if (before.restrictWithdrawals && !after.restrictWithdrawals) {
    kinds.add("withdrawal_hold_released");
  }

  const depositTightened = !before.restrictDeposits && after.restrictDeposits;
  const transferTightened = !before.restrictTransfers && after.restrictTransfers;
  const depositLoosened = before.restrictDeposits && !after.restrictDeposits;
  const transferLoosened = before.restrictTransfers && !after.restrictTransfers;

  if (depositTightened || transferTightened) {
    kinds.add("account_restricted");
  }
  if (depositLoosened || transferLoosened) {
    kinds.add("restriction_removed");
  }

  return [...kinds];
}
