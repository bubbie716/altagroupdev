"use client";

import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canAccessTerminalInternal } from "@/lib/auth/permissions";
import { INTERNAL_TERMINAL_PORTFOLIO_WORKSPACE_SEARCH, withInternalSiteSearch } from "@/lib/internal/internal-route-search";
import { RecordEmptyCopy } from "@/components/internal/workspace/record-workspace-layout";
import { fetchTerminalPortfolios } from "@/lib/terminal/terminal-ops.functions";
import type { TerminalOpsPortfolioRow } from "@/lib/terminal/terminal-ops-types";

export function TerminalOwnerPortfoliosBlock({
  ownerUserId,
  ownerCompanyId,
  site,
}: {
  ownerUserId?: string | null;
  ownerCompanyId?: string | null;
  site?: string | null;
}) {
  const user = useCurrentUser();
  const canLoad = user ? canAccessTerminalInternal(user) : false;
  const [rows, setRows] = useState<TerminalOpsPortfolioRow[] | null>(null);

  useEffect(() => {
    if (!canLoad) {
      setRows([]);
      return;
    }
    let cancelled = false;
    void fetchTerminalPortfolios()
      .then((all) => {
        if (cancelled) return;
        setRows(
          all.filter((p) => {
            if (ownerUserId) return p.ownerUserId === ownerUserId;
            if (ownerCompanyId) return p.ownerCompanyId === ownerCompanyId;
            return false;
          }),
        );
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [canLoad, ownerUserId, ownerCompanyId]);

  if (!canLoad) {
    return <RecordEmptyCopy>Terminal portfolio list requires Terminal operations access.</RecordEmptyCopy>;
  }

  if (rows === null) {
    return <p className="text-[12px] text-muted-foreground">Loading Terminal portfolios…</p>;
  }

  if (rows.length === 0) {
    return <RecordEmptyCopy>No Terminal portfolios on file.</RecordEmptyCopy>;
  }

  return (
    <ul className="space-y-1.5 text-[12px]">
      {rows.map((p) => (
        <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2">
          <Link
            to="/internal/terminal/portfolios/$portfolioId"
            params={{ portfolioId: p.id }}
            search={withInternalSiteSearch(INTERNAL_TERMINAL_PORTFOLIO_WORKSPACE_SEARCH, site)}
            className="min-w-0 break-words hover:text-gold"
          >
            {p.name}
          </Link>
          <span className="text-muted-foreground">{p.status === "active" ? "Active" : "Archived"}</span>
        </li>
      ))}
    </ul>
  );
}
