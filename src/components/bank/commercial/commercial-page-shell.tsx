import type { ReactNode } from "react";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { Section } from "@/components/page-shell";
import { CommercialAccountBackLink } from "@/components/bank/commercial-account-back-link";
import { CommercialVerificationGate } from "@/components/bank/commercial/commercial-verification-gate";
import type { CommercialBankingContext } from "@/lib/bank/commercial-banking-types";
import { COMMERCIAL_PLAN_LABELS } from "@/lib/bank/commercial-banking-types";

export function CommercialPageShell({
  context,
  title,
  children,
}: {
  context: CommercialBankingContext & { accountId?: string | null };
  title: string;
  children: ReactNode;
}) {
  const accountId = context.accountId ?? undefined;

  return (
    <>
      <BankPageMeta
        eyebrow="Commercial Banking"
        title={title}
        description={`${context.companyName} · ${COMMERCIAL_PLAN_LABELS[context.plan.commercialPlan]} plan`}
      />
      {accountId ? <CommercialAccountBackLink accountId={accountId} /> : null}
      {!context.isVerified ? (
        <Section title="Alta Commercial">
          <CommercialVerificationGate
            companyName={context.companyName}
            verificationStatus={context.verificationStatus}
          />
        </Section>
      ) : (
        children
      )}
    </>
  );
}
