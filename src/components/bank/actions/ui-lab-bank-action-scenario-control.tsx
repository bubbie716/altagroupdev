"use client";

import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useSiteContext } from "@/hooks/use-site-context";
import type { SiteKey } from "@/config/sites";
import {
  getBankActionUiLabScenario,
  setBankActionUiLabScenario,
  type BankActionUiLabScenario,
} from "@/lib/bank/bank-action-ui-lab";

const SCENARIOS: { value: BankActionUiLabScenario; label: string }[] = [
  { value: "success", label: "Success" },
  { value: "pending_review", label: "Pending review" },
  { value: "validation_error", label: "Validation error" },
  { value: "server_error", label: "Server error" },
  { value: "eligibility_error", label: "Eligibility error" },
  { value: "idempotent_replay", label: "Idempotent replay" },
];

const CORPORATE_BANK_WORKFLOW_PREFIXES = [
  "/internal/bank",
  "/internal/lending",
  "/internal/alta-card",
  "/internal/inbox",
  "/internal/queues",
  "/internal/users",
  "/internal/companies",
] as const;

const CORPORATE_EXCLUDED_PREFIXES = [
  "/internal/jobs",
  "/internal/embeds",
  "/internal/reports",
  "/internal/compliance",
  "/internal/settings",
  "/internal/audit",
] as const;

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function shouldShowBankActionScenarioControl(siteKey: SiteKey, pathname: string): boolean {
  if (siteKey === "terminal" || siteKey === "exchange") {
    return false;
  }

  if (siteKey === "bank") {
    return true;
  }

  if (siteKey === "corporate") {
    if (CORPORATE_EXCLUDED_PREFIXES.some((prefix) => pathMatchesPrefix(pathname, prefix))) {
      return false;
    }
    return CORPORATE_BANK_WORKFLOW_PREFIXES.some((prefix) => pathMatchesPrefix(pathname, prefix));
  }

  return false;
}

/** UI Lab only — Bank action scenarios; hidden on Terminal/Exchange and unrelated Corporate pages. */
export function UiLabBankActionScenarioControl() {
  const site = useSiteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [scenario, setScenario] = useState<BankActionUiLabScenario>(() =>
    getBankActionUiLabScenario(),
  );

  useEffect(() => {
    // Re-sync after mount in case SSR/default differed from sessionStorage.
    setScenario(getBankActionUiLabScenario());
  }, []);

  if (!shouldShowBankActionScenarioControl(site.key, pathname)) {
    return null;
  }

  return (
    <label
      className="ml-3 inline-flex items-center gap-2 normal-case tracking-normal"
      style={{ fontSize: 11 }}
    >
      <span className="opacity-90">Bank action:</span>
      <select
        aria-label="UI Lab bank action scenario"
        value={scenario}
        onChange={(event) => {
          const next = event.target.value as BankActionUiLabScenario;
          setBankActionUiLabScenario(next);
          setScenario(next);
        }}
        style={{
          background: "rgba(0,0,0,0.25)",
          border: "1px solid rgba(255,255,255,0.35)",
          borderRadius: 4,
          color: "white",
          fontSize: 11,
          padding: "2px 6px",
          maxWidth: 160,
        }}
      >
        {SCENARIOS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
