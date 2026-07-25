"use client";

import { useEffect, useState } from "react";
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
  { value: "idempotent_replay", label: "Idempotent replay" },
];

/** UI Lab only — never mount outside UI Lab mode. */
export function UiLabBankActionScenarioControl() {
  const [scenario, setScenario] = useState<BankActionUiLabScenario>("success");

  useEffect(() => {
    setScenario(getBankActionUiLabScenario());
  }, []);

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
