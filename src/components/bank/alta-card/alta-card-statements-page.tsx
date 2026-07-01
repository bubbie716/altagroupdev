"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Section, Card } from "@/components/page-shell";
import { BankPageMeta } from "@/components/bank/bank-page-layout";
import { AltaCardStatementList } from "@/components/bank/alta-card/alta-card-statement-views";
import { AltaCardStatementGenerateForm } from "@/components/bank/alta-card/alta-card-statement-generate-form";
import { AltaCardBackToCardButton, AltaCardPageNav } from "@/components/bank/alta-card/alta-card-back-to-card-link";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canManageCompanyAltaCard } from "@/lib/auth/permissions";
import { fetchCardStatements } from "@/lib/bank/alta-card-statement.functions";
import type { AltaCardRow, AltaCardStatementDetail, AltaCardStatementRow } from "@/lib/bank/alta-card-types";
import {
  isAltaCardCustomPeriodStatement,
  isAltaCardOfficialBillingStatement,
} from "@/lib/bank/alta-card-types";

function sortStatementsNewestFirst(rows: AltaCardStatementRow[]): AltaCardStatementRow[] {
  return [...rows].sort((a, b) => b.statementNumber - a.statementNumber);
}

function mergeStatementRow(
  current: AltaCardStatementRow[],
  statement: AltaCardStatementRow,
): AltaCardStatementRow[] {
  const next = current.some((row) => row.id === statement.id)
    ? current.map((row) => (row.id === statement.id ? statement : row))
    : [statement, ...current];
  return sortStatementsNewestFirst(next);
}

export function AltaCardStatementsPageContent({
  cardId,
  card,
  statements: initialStatements,
  defaultPeriod,
}: {
  cardId: string;
  card: AltaCardRow;
  statements: AltaCardStatementRow[];
  defaultPeriod?: { periodStart: string; periodEnd: string };
}) {
  const router = useRouter();
  const user = useCurrentUser();
  const loadStatements = useServerFn(fetchCardStatements);
  const [statements, setStatements] = useState(initialStatements);

  const canGenerate =
    card.cardType === "personal" ||
    (card.cardType === "business" &&
      card.companyId != null &&
      user != null &&
      canManageCompanyAltaCard(user, card.companyId));

  const refreshStatements = useCallback(async () => {
    const rows = await loadStatements({ data: cardId });
    setStatements(rows);
    return rows;
  }, [cardId, loadStatements]);

  useEffect(() => {
    setStatements(initialStatements);
  }, [initialStatements]);

  useEffect(() => {
    void refreshStatements();
  }, [refreshStatements]);

  const handleStatementGenerated = useCallback(
    async (statement: AltaCardStatementDetail) => {
      setStatements((current) => mergeStatementRow(current, statement));
      await router.invalidate();
      await refreshStatements();
    },
    [refreshStatements, router],
  );

  const officialStatements = statements.filter((row) =>
    isAltaCardOfficialBillingStatement(row.status),
  );
  const activitySummaries = statements.filter((row) =>
    isAltaCardCustomPeriodStatement(row.status),
  );

  return (
    <>
      <BankPageMeta eyebrow="Alta Bank · Alta Card" title="Statements" />
      <AltaCardPageNav>
        <AltaCardBackToCardButton card={card} />
      </AltaCardPageNav>

      {canGenerate ? (
        <Section title="Custom activity summary" className="mb-10">
          <Card className="mx-auto max-w-xl !p-6">
            <AltaCardStatementGenerateForm
              cardId={cardId}
              card={card}
              defaultPeriod={defaultPeriod}
              onStatementGenerated={handleStatementGenerated}
            />
          </Card>
        </Section>
      ) : null}

      <Section title="Official billing statements">
        <AltaCardStatementList
          cardId={cardId}
          statements={officialStatements}
          card={card}
          listKind="official"
        />
      </Section>

      {canGenerate || activitySummaries.length > 0 ? (
        <Section title="Activity summaries" className="mt-10">
          <AltaCardStatementList
            cardId={cardId}
            statements={activitySummaries}
            card={card}
            listKind="activity"
          />
        </Section>
      ) : null}
    </>
  );
}
