"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { isUiLabMode } from "@/lib/auth/ui-lab";
import {
  getUiLabProductConsentScenario,
  setUiLabProductConsentScenario,
  UI_LAB_PRODUCT_CONSENT_OPTIONS,
  type UiLabProductConsentScenario,
} from "@/lib/legal/ui-lab-product-consent";

export function UiLabProductConsentScenarioControl() {
  const router = useRouter();
  const [scenario, setScenario] = useState<UiLabProductConsentScenario>("already_accepted_no_flash");

  useEffect(() => {
    if (!isUiLabMode()) return;
    const next = getUiLabProductConsentScenario();
    setScenario(next);
    setUiLabProductConsentScenario(next);
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
      <span>Product consent</span>
      <select
        value={scenario}
        aria-label="UI Lab product consent scenario"
        onChange={(e) => {
          const next = e.target.value as UiLabProductConsentScenario;
          setUiLabProductConsentScenario(next);
          setScenario(next);
          void router.invalidate();
        }}
        style={{
          maxWidth: 200,
          background: "rgba(0,0,0,0.25)",
          color: "white",
          border: "1px solid rgba(255,255,255,0.35)",
          borderRadius: 4,
          padding: "2px 6px",
          fontSize: 11,
        }}
      >
        {UI_LAB_PRODUCT_CONSENT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
