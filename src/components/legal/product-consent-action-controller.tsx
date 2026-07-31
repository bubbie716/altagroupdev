"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import type { SiteKey } from "@/config/sites";
import type { LegalConsentScopeId } from "@/lib/legal/consent-scopes";
import {
  fetchProductConsentStatus,
  submitProductConsentFn,
} from "@/lib/legal/product-consent.functions";
import { parseConsentRequiredFromError } from "@/lib/legal/parse-consent-required";
import {
  actionConsentSequenceProgress,
  canResumeProtectedAction,
} from "@/lib/legal/ui-lab-action-consent";
import {
  getUiLabAcceptedOverlaySnapshot,
  getUiLabProductConsentScenario,
  getUiLabProductConsentScenarioGeneration,
  recordUiLabAcceptedScope,
} from "@/lib/legal/ui-lab-product-consent";
import { isUiLabMode } from "@/lib/auth/ui-lab";
import { ProductConsentDialog } from "@/components/legal/product-consent-dialog";

type GateState = Awaited<ReturnType<typeof fetchProductConsentStatus>>;

type PendingResume = {
  resolve: () => void;
  reject: (error: unknown) => void;
};

type ActionConsentApi = {
  /**
   * Run a protected mutation. On CONSENT_REQUIRED, open progressive consent,
   * collect every missing scope, then retry the action exactly once.
   */
  runWithConsent: <T>(execute: () => Promise<T>) => Promise<T>;
  /** Explicitly request consent for scopes before submit (optional proactive path). */
  requestConsent: (scopes: LegalConsentScopeId[], companyId?: string | null) => Promise<void>;
  /** True while the action-consent dialog is collecting agreements. */
  open: boolean;
};

const ProductConsentActionContext = createContext<ActionConsentApi | null>(null);

export function useProductConsentAction(): ActionConsentApi {
  const ctx = useContext(ProductConsentActionContext);
  if (!ctx) {
    throw new Error("useProductConsentAction must be used within ProductConsentActionProvider");
  }
  return ctx;
}

/** Optional hook — returns null outside provider (forms can fall back gracefully). */
export function useOptionalProductConsentAction(): ActionConsentApi | null {
  return useContext(ProductConsentActionContext);
}

function withSequenceProgress(
  state: GateState,
  initialMissing: LegalConsentScopeId[],
): GateState {
  if (!state.current || initialMissing.length <= 1) return state;
  const sequence = actionConsentSequenceProgress(initialMissing, state.current.scope);
  if (!sequence) return state;
  return {
    ...state,
    current: {
      ...state.current,
      sequence,
    },
  };
}

export function ProductConsentActionProvider({
  sourceSite,
  theme = "bank",
  children,
}: {
  sourceSite: SiteKey;
  theme?: "bank" | "terminal";
  children: ReactNode;
}) {
  const fetchStatus = useServerFn(fetchProductConsentStatus);
  const submitConsent = useServerFn(submitProductConsentFn);

  const [gate, setGate] = useState<GateState | null>(null);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successFlash, setSuccessFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName] = useState<string | null>(null);
  const [requestedScopes, setRequestedScopes] = useState<LegalConsentScopeId[]>([]);
  const [, setScenarioTick] = useState(0);

  const pendingRef = useRef<PendingResume | null>(null);
  const resumeOnceRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const initialMissingRef = useRef<LegalConsentScopeId[]>([]);
  const fetchGenerationRef = useRef(0);
  const scenarioGenerationRef = useRef(
    isUiLabMode() ? getUiLabProductConsentScenarioGeneration() : 0,
  );

  useEffect(() => {
    if (!isUiLabMode()) return;
    const onScenario = () => {
      fetchGenerationRef.current += 1;
      scenarioGenerationRef.current = getUiLabProductConsentScenarioGeneration();
      setScenarioTick((n) => n + 1);
    };
    window.addEventListener("alta:product-consent-scenario", onScenario);
    window.addEventListener("storage", onScenario);
    return () => {
      window.removeEventListener("alta:product-consent-scenario", onScenario);
      window.removeEventListener("storage", onScenario);
    };
  }, []);

  const presentation = gate?.current ?? null;

  const allChecked = useMemo(() => {
    if (!presentation) return false;
    return presentation.controlGroups.every((group) => checked[group.id]);
  }, [checked, presentation]);

  const clearDialog = useCallback(() => {
    setOpen(false);
    setGate(null);
    setChecked({});
    setError(null);
    setSuccessFlash(false);
    setSubmitting(false);
    initialMissingRef.current = [];
    const focusEl = returnFocusRef.current;
    returnFocusRef.current = null;
    if (focusEl) {
      window.setTimeout(() => focusEl.focus(), 0);
    }
  }, []);

  const failPending = useCallback(
    (err: unknown) => {
      const pending = pendingRef.current;
      pendingRef.current = null;
      resumeOnceRef.current = false;
      clearDialog();
      pending?.reject(err);
    },
    [clearDialog],
  );

  const completePending = useCallback(() => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    resumeOnceRef.current = false;
    clearDialog();
    pending?.resolve();
  }, [clearDialog]);

  const loadGate = useCallback(
    async (scopes: LegalConsentScopeId[], nextCompanyId?: string | null) => {
      const generation = ++fetchGenerationRef.current;
      const startedScenarioGeneration = scenarioGenerationRef.current;
      const scenario = isUiLabMode() ? getUiLabProductConsentScenario() : undefined;
      const state = await fetchStatus({
        data: {
          scopes,
          companyId: nextCompanyId,
          companyName,
          uiLabScenario: scenario,
          uiLabAcceptedOverlay: isUiLabMode()
            ? getUiLabAcceptedOverlaySnapshot(scenario)
            : undefined,
        },
      });
      if (
        generation !== fetchGenerationRef.current ||
        startedScenarioGeneration !== scenarioGenerationRef.current
      ) {
        return { state: null as GateState | null, stale: true as const };
      }
      const progressed = withSequenceProgress(state, initialMissingRef.current);
      setGate(progressed);
      setChecked({});
      return { state: progressed, stale: false as const };
    },
    [companyName, fetchStatus],
  );

  const requestConsent = useCallback(
    async (scopes: LegalConsentScopeId[], nextCompanyId?: string | null) => {
      if (scopes.length === 0) return;
      returnFocusRef.current =
        typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null;
      setRequestedScopes(scopes);
      setCompanyId(nextCompanyId ?? null);
      setError(null);
      setSuccessFlash(false);
      resumeOnceRef.current = false;
      initialMissingRef.current = [];

      const { state, stale } = await loadGate(scopes, nextCompanyId);
      if (stale || !state) return;
      if (canResumeProtectedAction(state.missingScopes)) {
        return;
      }

      initialMissingRef.current = [...state.missingScopes];
      setGate(withSequenceProgress(state, initialMissingRef.current));
      setOpen(true);

      await new Promise<void>((resolve, reject) => {
        pendingRef.current = { resolve, reject };
      });
    },
    [loadGate],
  );

  const runWithConsent = useCallback(
    async <T,>(execute: () => Promise<T>): Promise<T> => {
      try {
        return await execute();
      } catch (err) {
        const payload = parseConsentRequiredFromError(err);
        if (!payload) throw err;

        if (payload.missingScopes.length === 0) {
          throw new Error(
            "Additional product terms are required before this action can continue. Refresh and try again.",
          );
        }

        await requestConsent(payload.missingScopes, payload.companyId);

        // Authoritative rule: reconcile immediately before resume.
        const { state, stale } = await loadGate(payload.missingScopes, payload.companyId);
        if (stale || !state || !canResumeProtectedAction(state.missingScopes)) {
          throw new Error(
            "Additional product terms are still required before this action can continue.",
          );
        }
        if (resumeOnceRef.current) {
          throw new Error("Consent flow already completed. Please try again.");
        }
        resumeOnceRef.current = true;
        return await execute();
      }
    },
    [loadGate, requestConsent],
  );

  const onToggle = (id: string, value: boolean) => {
    setChecked((prev) => ({ ...prev, [id]: value }));
  };

  const onSafeExit = () => {
    failPending(new Error("CONSENT_CANCELLED"));
  };

  const onSubmit = async () => {
    if (!presentation || !allChecked || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const scenario = isUiLabMode() ? getUiLabProductConsentScenario() : undefined;
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
      if (isUiLabMode()) {
        recordUiLabAcceptedScope(presentation.scope, companyId, scenario);
      }
      setSuccessFlash(true);
      await new Promise((r) => setTimeout(r, 400));

      const { state: next, stale } = await loadGate(requestedScopes, companyId);
      if (stale || !next) {
        setSuccessFlash(false);
        return;
      }

      // Never resume until every requested scope is current.
      // Do not router.invalidate() here mid-sequence — invalidation remounts action
      // sheets and aborts the pending mutation resume.
      if (canResumeProtectedAction(next.missingScopes)) {
        const confirm = await loadGate(requestedScopes, companyId);
        if (
          !confirm.stale &&
          confirm.state &&
          canResumeProtectedAction(confirm.state.missingScopes)
        ) {
          completePending();
          return;
        }
      }
      setSuccessFlash(false);
    } catch (err) {
      const message =
        err instanceof Error && err.message === "CONSENT_AUTHORITY_FORBIDDEN"
          ? "You are not authorized to accept these terms for this company."
          : "We could not record your acceptance. Your selections were kept — try again.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const api = useMemo<ActionConsentApi>(
    () => ({
      runWithConsent,
      requestConsent,
      open,
    }),
    [open, requestConsent, runWithConsent],
  );

  return (
    <ProductConsentActionContext.Provider value={api}>
      {children}
      {open && presentation ? (
        <ProductConsentDialog
          open
          blocking
          theme={theme}
          presentation={presentation}
          checked={checked}
          onToggle={onToggle}
          onSubmit={() => void onSubmit()}
          submitting={submitting}
          success={successFlash}
          error={error}
          allChecked={allChecked}
          safeExitHref="#"
          safeExitLabel="Cancel"
          onSafeExit={onSafeExit}
        />
      ) : null}
    </ProductConsentActionContext.Provider>
  );
}
