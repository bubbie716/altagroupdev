"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { generateMonthlyStatementsBatch } from "@/lib/bank/statement.functions";

export function InternalStatementBatchButton() {
  const router = useRouter();
  const runBatch = useServerFn(generateMonthlyStatementsBatch);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setResult(null);
    try {
      const batch = await runBatch();
      setResult(
        `Created ${batch.created} statement(s), skipped ${batch.skipped}.${batch.errors.length ? ` ${batch.errors.length} error(s).` : ""}`,
      );
      await router.invalidate();
    } catch {
      setResult("Batch generation failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => void handleClick()}
        className="rounded-md border border-border-strong bg-surface-2 px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-2/80 disabled:opacity-50"
      >
        {pending ? "Generating…" : "Generate monthly statements (preview batch)"}
      </button>
      {result && <p className="text-[13px] text-muted-foreground">{result}</p>}
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        Creates prior-calendar-month statements for active accounts that do not already have one.
        No PDF export or email delivery — database records only.
      </p>
    </div>
  );
}
