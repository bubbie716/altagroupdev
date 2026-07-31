"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { SiteKey } from "@/config/sites";
import type { LegalConsentScopeId } from "@/lib/legal/consent-scopes";
import {
  fetchProductConsentStatus,
  submitProductConsentFn,
} from "@/lib/legal/product-consent.functions";
import {
  getUiLabProductConsentScenario,
  isUiLabProductConsentScenario,
} from "@/lib/legal/ui-lab-product-consent";
import { isUiLabMode } from "@/lib/auth/ui-lab";
import { ProductConsentDialog } from "@/components/legal/product-consent-dialog";

type GateState = Awaited<ReturnType<typeof fetchProductConsentStatus>>;

export type ProductConsentBoundaryProps = {
  scopes: LegalConsentScopeId[];
  sourceSite: SiteKey;
  companyId?: string | null;
  companyName?: string | null;
  /**
   * Soft gate: still load children for view/repay exceptions; consent only blocks
   * when `blockChildren` is true (default for hard product entry).
   */
  soft?: boolean;
  theme?: "bank" | "terminal";
  safeExitHref?: string;
  safeExitLabel?: string;
  children: ReactNode;
};

/**
 * Reusable progressive product-consent boundary.
 * Blocks the requested product until current required scopes are accepted.
 * Preserves the current route; no hard reload after acceptance.
 */
export function ProductConsentBoundary({
  scopes,
  sourceSite,
  companyId,
  companyName,
  soft = false,
  theme = "bank",
  safeExitHref = "/home",
  safeExitLabel = "Back to Alta",
  children,
}: ProductConsentBoundaryProps) {
  const router = useRouter();
  const fetchStatus = useServerFn(fetchProductConsentStatus);
  const submitConsent = useServerFn(submitProductConsentFn);

  const [gate, setGate] = useState<GateState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successFlash, setSuccessFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const loadedKeyRef = useRef<string>("");

  const scenario = isUiLabMode() ? getUiLabProductConsentScenario() : undefined;
  const [scenarioTick, setScenarioTick] = useState(0);
  const loadKey = `${scopes.join(",")}|${companyId ?? ""}|${scenario ?? ""}|${scenarioTick}`;

  useEffect(() => {
    if (!isUiLabMode()) return;
    const onStorage = (event: StorageEvent) => {
      if (event.key === "alta.productConsent.uiLabScenario") {
        setScenarioTick((n) => n + 1);
      }
    };
    const onCustom = () => setScenarioTick((n) => n + 1);
    window.addEventListener("storage", onStorage);
    window.addEventListener("alta:product-consent-scenario", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("alta:product-consent-scenario", onCustom);
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const state = await fetchStatus({
        data: {
          scopes,
          companyId,
          companyName,
          uiLabScenario: scenario,
        },
      });
      setGate(state);
      setChecked({});
      if (!state.current) {
        setSuccessFlash(false);
      }
    } catch {
      setError("Unable to verify product terms right now. Try again shortly.");
    } finally {
      setLoading(false);
    }
  }, [companyId, companyName, fetchStatus, scenario, scopes]);

  useEffect(() => {
    if (loadedKeyRef.current === loadKey && gate) return;
    loadedKeyRef.current = loadKey;
    void refresh();
  }, [gate, loadKey, refresh]);

  const presentation = gate?.current ?? null;
  const blocking = Boolean(presentation) && !soft;

  const allChecked = useMemo(() => {
    if (!presentation) return false;
    return presentation.controlGroups.every((group) => checked[group.id]);
  }, [checked, presentation]);

  const onToggle = (id: string, value: boolean) => {
    setChecked((prev) => ({ ...prev, [id]: value }));
  };

  const onSubmit = async () => {
    if (!presentation || !allChecked || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitConsent({
        data: {
          scope: presentation.scope,
          sourceSite,
          companyId: presentation.scope === "COMMERCIAL" ? companyId : undefined,
          authorityConfirmed: Boolean(checked.authority),
          acceptedControlIds: presentation.controlGroups
            .filter((g) => checked[g.id])
            .map((g) => g.id),
          uiLabScenario: scenario,
        },
      });
      setSuccessFlash(true);
      // Brief success, then advance to next missing scope or clear.
      await new Promise((r) => setTimeout(r, 450));
      if (isUiLabMode() && scenario) {
        // UI Lab scenarios are sticky; after a successful mock accept, advance so the
        // dialog does not immediately reappear for the same first-visit scenario.
        const { setUiLabProductConsentScenario } = await import(
          "@/lib/legal/ui-lab-product-consent"
        );
        const remaining = (gate?.missingScopes ?? []).filter((s) => s !== presentation.scope);
        if (remaining.length === 0) {
          setUiLabProductConsentScenario("already_accepted_no_flash");
        }
      }
      await refresh();
      await router.invalidate();
      setSuccessFlash(false);
    } catch (err) {
      const message =
        err instanceof Error && err.message === "CONSENT_AUTHORITY_FORBIDDEN"
          ? "You are not authorized to accept these terms for this company."
          : err instanceof Error && err.message === "CONSENT_RECORDING_FAILED"
            ? "We could not record your acceptance. Your selections were kept — try again."
            : "We could not record your acceptance. Your selections were kept — try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const showDialog = Boolean(presentation);
  const showChildren = soft || (!loading && !presentation);

  return (
    <>
      {blocking && loading ? (
        <div className="flex min-h-[40vh] items-center justify-center px-6 text-[13px] text-muted-foreground">
          Checking product terms…
        </div>
      ) : null}

      {showChildren ? children : null}

      {blocking && presentation && !soft ? (
        <div aria-hidden className="pointer-events-none min-h-[40vh] opacity-30 blur-[1px]">
          <div className="mx-auto max-w-lg px-6 py-16 text-center text-muted-foreground">
            Waiting for product terms…
          </div>
        </div>
      ) : null}

      {showDialog && presentation ? (
        <ProductConsentDialog
          open
          theme={theme}
          presentation={presentation}
          checked={checked}
          onToggle={onToggle}
          onSubmit={() => void onSubmit()}
          submitting={submitting}
          success={successFlash}
          error={error}
          allChecked={allChecked}
          safeExitHref={safeExitHref}
          safeExitLabel={safeExitLabel}
        />
      ) : null}
    </>
  );
}

/** Hook-friendly resolver for funding / pay flows that need sequential consent before submit. */
export function useProductConsentGate(input: {
  scopes: LegalConsentScopeId[];
  companyId?: string | null;
  companyName?: string | null;
}) {
  const fetchStatus = useServerFn(fetchProductConsentStatus);
  const [missing, setMissing] = useState<LegalConsentScopeId[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const scenario = isUiLabMode() ? getUiLabProductConsentScenario() : undefined;
      try {
        const state = await fetchStatus({
          data: {
            scopes: input.scopes,
            companyId: input.companyId,
            companyName: input.companyName,
            uiLabScenario: scenario,
          },
        });
        if (cancelled) return;
        setMissing(state.missingScopes);
        setReady(state.missingScopes.length === 0);
      } catch {
        if (!cancelled) {
          setReady(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchStatus, input.companyId, input.companyName, input.scopes]);

  return { missingScopes: missing, ready };
}

export function ProductConsentSafeExitLinks({
  safeExitHref,
  safeExitLabel,
}: {
  safeExitHref: string;
  safeExitLabel: string;
}) {
  const logoutHref = "/api/auth/logout";
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[12px] text-muted-foreground">
      <Link to={safeExitHref} className="underline-offset-2 hover:underline">
        {safeExitLabel}
      </Link>
      <a href="/legal" className="underline-offset-2 hover:underline">
        Legal
      </a>
      <a href="/support" className="underline-offset-2 hover:underline">
        Support
      </a>
      <a href={logoutHref} className="underline-offset-2 hover:underline">
        Log out
      </a>
    </div>
  );
}

export function ProductConsentScenarioBadge() {
  if (!isUiLabMode()) return null;
  const scenario = getUiLabProductConsentScenario();
  if (!isUiLabProductConsentScenario(scenario)) return null;
  return (
    <div className="fixed bottom-2 left-2 z-[200] rounded bg-amber-500/90 px-2 py-1 font-mono text-[10px] text-black">
      UI Lab consent: {scenario}
    </div>
  );
}
