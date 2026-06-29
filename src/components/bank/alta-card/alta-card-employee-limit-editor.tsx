"use client";

import { useEffect, useState } from "react";
import type { AltaEmployeeCardRow } from "@/lib/bank/alta-card-types";
import { updateEmployeeCardLimitRecord } from "@/lib/bank/alta-card.functions";
import { BankReviewButton } from "@/components/bank/bank-review-button";

export function AltaCardEmployeeLimitEditor({
  employeeCard,
  onUpdated,
}: {
  employeeCard: AltaEmployeeCardRow;
  onUpdated: () => Promise<void>;
}) {
  const [limit, setLimit] = useState(String(employeeCard.employeeSpendLimit));

  useEffect(() => {
    setLimit(String(employeeCard.employeeSpendLimit));
  }, [employeeCard.employeeSpendLimit]);

  if (employeeCard.status === "closed") return null;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="block min-w-0">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          Spend limit
        </span>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={limit}
          onChange={(e) => setLimit(e.target.value)}
          className="mt-1 w-full min-w-[7rem] rounded-md border border-border bg-surface-1 px-2 py-1.5 font-mono text-[12px] tabular-nums"
          aria-label={`Spend limit for ${employeeCard.authorizedUsername}`}
        />
      </label>
      <BankReviewButton
        label="Update limit"
        requireReason={false}
        onAction={async () => {
          const parsed = Number(limit);
          if (!Number.isFinite(parsed) || parsed <= 0) {
            throw new Error("Enter a valid spend limit");
          }
          await updateEmployeeCardLimitRecord({
            data: { employeeCardId: employeeCard.id, employeeSpendLimit: parsed },
          });
          await onUpdated();
        }}
      />
    </div>
  );
}
