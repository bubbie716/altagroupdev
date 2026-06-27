import { PageShell, Section } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { AltaCardStatementList } from "@/components/bank/alta-card/alta-card-statement-views";
import { AltaCardBackToCardButton, AltaCardPageNav } from "@/components/bank/alta-card/alta-card-back-to-card-link";
import type { AltaCardRow } from "@/lib/bank/alta-card-types";
import type { AltaCardStatementRow } from "@/lib/bank/alta-card-types";

export function AltaCardStatementsPageContent({
  cardId,
  card,
  statements,
}: {
  cardId: string;
  card: AltaCardRow;
  statements: AltaCardStatementRow[];
}) {
  void cardId;

  return (
    <PageShell
      eyebrow="Alta Bank · Alta Card"
      title="Statements"
    >
      <BankSubNav />
      <AltaCardPageNav>
        <AltaCardBackToCardButton card={card} />
      </AltaCardPageNav>

      <Section title="Statements on file">
        <AltaCardStatementList cardId={cardId} statements={statements} card={card} />
      </Section>
    </PageShell>
  );
}
