import type { ReactNode } from "react";
import { Section } from "@/components/page-shell";
import { CommercialVerificationGate } from "@/components/bank/commercial/commercial-verification-gate";
import type { CommercialBankingContext } from "@/lib/bank/commercial-banking-types";

/** Commercial content shell for business account pages (no top-level bank chrome). */
export function AccountCommercialShell({
  context,
  children,
}: {
  context: CommercialBankingContext;
  children: ReactNode;
}) {
  if (!context.isVerified) {
    return (
      <Section title="Alta Commercial">
        <CommercialVerificationGate
          companyName={context.companyName}
          verificationStatus={context.verificationStatus}
        />
      </Section>
    );
  }

  return <>{children}</>;
}
