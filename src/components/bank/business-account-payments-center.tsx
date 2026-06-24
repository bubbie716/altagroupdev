"use client";

import { useServerFn } from "@tanstack/react-start";
import {
  cancelScheduledPaymentRecord,
  createScheduledPaymentRecord,
} from "@/lib/bank/business-banking.functions";
import type { BusinessTreasuryCompany, ScheduledPaymentRow } from "@/lib/bank/business-banking-types";
import type { TransferContact } from "@/lib/bank/backend-types";
import { ScheduledTransferCenter, type ScheduledTransferTab } from "@/components/bank/scheduled-transfer-center";

export function BusinessAccountPaymentsCenter({
  company,
  payments,
  contacts = [],
  activeTab,
  onTabChange,
  onChanged,
}: {
  company: BusinessTreasuryCompany;
  payments: ScheduledPaymentRow[];
  contacts?: TransferContact[];
  activeTab?: ScheduledTransferTab;
  onTabChange?: (tab: ScheduledTransferTab) => void;
  onChanged?: () => void | Promise<void>;
}) {
  const createPayment = useServerFn(createScheduledPaymentRecord);
  const cancelPayment = useServerFn(cancelScheduledPaymentRecord);

  return (
    <ScheduledTransferCenter
      transferScope="intrabank"
      activeTab={activeTab}
      onTabChange={onTabChange}
      sourceAccounts={[
        {
          id: company.operatingAccount.id,
          accountName: company.operatingAccount.accountName,
          accountNumber: company.operatingAccount.accountNumber,
          ownerLabel: company.companyName,
        },
      ]}
      payments={payments}
      contacts={contacts}
      canManage={company.permissions.canManage}
      viewOnlyMessage="Your role has view-only access. Contact an owner, executive, or finance manager to submit treasury transfers."
      onCreate={async (input) => {
        await createPayment({
          data: {
            companyId: company.companyId,
            bankAccountId: company.operatingAccount.id,
            paymentType: input.paymentType,
            recipientName: input.recipientName,
            recipientAccountNumber: input.recipientAccountNumber,
            amount: input.amount,
            scheduledDate: input.scheduledDate,
            scheduledTime: input.scheduledTime,
            frequency: input.frequency,
            memo: input.memo,
          },
        });
        await onChanged?.();
      }}
      onCancel={async (paymentId) => {
        await cancelPayment({ data: { companyId: company.companyId, paymentId } });
        await onChanged?.();
      }}
    />
  );
}
