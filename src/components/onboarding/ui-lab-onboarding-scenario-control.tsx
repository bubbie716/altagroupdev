"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  getUiLabOnboardingScenario,
  setUiLabOnboardingScenario,
  UI_LAB_ONBOARDING_SCENARIO_OPTIONS,
  type UiLabOnboardingScenario,
} from "@/lib/onboarding/ui-lab-onboarding";
import { isUiLabMode } from "@/lib/auth/ui-lab";

export function UiLabOnboardingScenarioControl() {
  const router = useRouter();
  const [scenario, setScenario] = useState<UiLabOnboardingScenario>("fully_verified");

  useEffect(() => {
    if (!isUiLabMode()) return;
    const next = getUiLabOnboardingScenario();
    setScenario(next);
    setUiLabOnboardingScenario(next);
  }, []);

  if (!isUiLabMode()) return null;

  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        marginLeft: 8,
        textTransform: "none",
        letterSpacing: "normal",
        fontSize: 11,
      }}
    >
      <span>Onboarding</span>
      <select
        value={scenario}
        aria-label="UI Lab onboarding scenario"
        onChange={(e) => {
          const next = e.target.value as UiLabOnboardingScenario;
          setUiLabOnboardingScenario(next);
          setScenario(next);
          void router.navigate({
            to: "/onboarding",
            search: { uiLabScenario: next },
            replace: true,
          });
        }}
        style={{
          maxWidth: 180,
          background: "rgba(0,0,0,0.25)",
          color: "white",
          border: "1px solid rgba(255,255,255,0.35)",
          borderRadius: 4,
          padding: "2px 6px",
          fontSize: 11,
        }}
      >
        {UI_LAB_ONBOARDING_SCENARIO_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
