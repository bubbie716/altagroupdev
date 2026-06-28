"use client";

import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { globalOpsSearch } from "@/lib/internal/ops-platform.functions";
import type { GlobalSearchResult } from "@/lib/internal/ops-types";
import { cn } from "@/lib/utils";

const typeLabels: Record<GlobalSearchResult["type"], string> = {
  user: "Customer",
  company: "Company",
  account: "Bank Account",
  transaction: "Transaction",
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  loan: "Loan",
  lending_application: "Lending App",
  statement: "Statement",
  alta_card: "Alta Card",
  alta_card_application: "Card Application",
  alta_card_review: "Card Review",
  alta_card_statement: "Card Statement",
  alta_pay: "Alta Pay",
  deal_room: "Deal Room",
  relationship_profile: "Relationship",
  company_relationship: "Co. Relationship",
  audit: "Audit",
  job_run: "Job Run",
};

export function InternalGlobalSearch({ variant = "page" }: { variant?: "page" | "header" }) {
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

  const isHeader = variant === "header";

  return (
    <div className={cn("relative min-w-0 flex-1", !isHeader && "mb-0 w-full")}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          type="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            void runSearch(e.target.value);
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          placeholder="Search customers, accounts, transactions…"
          aria-label="Global ops search"
          className={cn(
            "w-full rounded border border-border bg-surface-1 pl-8 pr-2 text-[12px] outline-none focus:border-gold/40",
            isHeader ? "h-8 py-1" : "px-4 py-2.5 text-sm shadow-card",
          )}
        />
        {pending ? (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
            …
          </span>
        ) : null}
      </div>
      {open && results.length > 0 ? (
        <div className="absolute z-50 mt-1 max-h-80 w-full min-w-[18rem] overflow-auto rounded border border-border bg-background shadow-elevated">
          {results.map((r) => (
            <button
              key={`${r.type}-${r.id}`}
              type="button"
              className="flex w-full items-start justify-between gap-3 border-b border-border/50 px-3 py-2.5 text-left hover:bg-surface-2/50"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setOpen(false);
                void router.navigate({ to: r.href });
              }}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-medium">{r.label}</div>
                <div className="truncate text-[11px] text-muted-foreground">{r.sublabel}</div>
                {r.amount || r.date ? (
                  <div className="mt-0.5 flex flex-wrap gap-2 font-mono text-[10px] text-muted-foreground/80">
                    {r.amount ? <span>{r.amount}</span> : null}
                    {r.date ? <span>{r.date}</span> : null}
                    {r.status ? <span>{r.status}</span> : null}
                  </div>
                ) : null}
              </div>
              <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-gold">
                {typeLabels[r.type]}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
