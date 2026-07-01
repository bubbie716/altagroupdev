"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { generateAltaCardStatementForPeriod } from "@/lib/bank/alta-card-statement.functions";
import type { AltaCardRow, AltaCardStatementDetail } from "@/lib/bank/alta-card-types";
import { altaCardStatementDetailLink } from "@/lib/bank/alta-card-navigation";
import { formatCustomerActionError } from "@/lib/bank/bank-action-errors";

const fieldClass =
  "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40";

export function AltaCardStatementGenerateForm({
  cardId,
  card,
  defaultPeriod,
  onStatementGenerated,
}: {
  cardId: string;
  card: Pick<AltaCardRow, "id" | "cardType" | "companyId">;
  defaultPeriod?: { periodStart: string; periodEnd: string };
  onStatementGenerated?: (statement: AltaCardStatementDetail) => void | Promise<void>;
}) {
  const router = useRouter();
  const generate = useServerFn(generateAltaCardStatementForPeriod);
  const [periodStart, setPeriodStart] = useState(defaultPeriod?.periodStart ?? "");
  const [periodEnd, setPeriodEnd] = useState(defaultPeriod?.periodEnd ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const statement = (await generate({
        data: { cardId, periodStart, periodEnd },
      })) as AltaCardStatementDetail;
      await onStatementGenerated?.(statement);
      await router.invalidate();
      await router.navigate(altaCardStatementDetailLink(card, statement.id));
    } catch (err) {
      const message =
        err instanceof Error && err.message === "FORBIDDEN"
          ? "You do not have permission to generate statements for this card."
          : formatCustomerActionError(err, "statement_generate");
      setError(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Generate a read-only activity summary for a custom date range. This is not an official
        billing statement and does not create a payment obligation. Official Alta Card statements
        are issued automatically at the end of each billing cycle.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          Period start
          <input
            className={fieldClass}
            type="date"
            value={periodStart}
            onChange={(e) => setPeriodStart(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          Period end
          <input
            className={fieldClass}
            type="date"
            value={periodEnd}
            onChange={(e) => setPeriodEnd(e.target.value)}
            required
          />
        </label>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-border-strong bg-surface-2 px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-2/80 disabled:opacity-50"
      >
        {pending ? "Generating…" : "Generate activity summary"}
      </button>
    </form>
  );
}
