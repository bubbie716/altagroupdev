"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { globalOpsSearch } from "@/lib/internal/ops-platform.functions";
import type { GlobalSearchResult } from "@/lib/internal/ops-types";

const typeLabels: Record<GlobalSearchResult["type"], string> = {
  user: "User",
  company: "Company",
  account: "Account",
  transaction: "Transaction",
  loan: "Loan",
  statement: "Statement",
  alta_pay: "Alta Pay",
};

export function InternalGlobalSearch() {
  const router = useRouter();
  const searchFn = useServerFn(globalOpsSearch);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function runSearch(value: string) {
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    setPending(true);
    try {
      const rows = await searchFn({ data: trimmed });
      setResults(rows);
      setOpen(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative mb-6">
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          void runSearch(e.target.value);
        }}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search users, accounts, transactions, loans, PAY refs…"
        className="w-full rounded-lg border border-border bg-surface-1 px-4 py-2.5 text-sm shadow-card"
      />
      {open && results.length > 0 ? (
        <div className="absolute z-40 mt-1 max-h-80 w-full overflow-auto rounded-lg border border-border bg-background shadow-elevated">
          {results.map((r) => (
            <button
              key={`${r.type}-${r.id}`}
              type="button"
              className="flex w-full items-start justify-between gap-3 border-b border-border/50 px-4 py-3 text-left hover:bg-surface-2/50"
              onClick={() => {
                setOpen(false);
                void router.navigate({ to: r.href });
              }}
            >
              <div>
                <div className="font-mono text-[12px]">{r.label}</div>
                <div className="text-[12px] text-muted-foreground">{r.sublabel}</div>
              </div>
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-gold">
                {typeLabels[r.type]}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {pending ? (
        <p className="absolute right-3 top-3 text-[11px] text-muted-foreground">Searching…</p>
      ) : null}
    </div>
  );
}
