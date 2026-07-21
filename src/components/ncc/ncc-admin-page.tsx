"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import { NccLayout } from "@/components/ncc/ncc-layout";
import { NccMaintenanceModePanel } from "@/components/ncc/ncc-maintenance-mode-panel";
import {
  NccBadge,
  NccButton,
  NccCard,
  NccPageContainer,
  type NccStatus,
} from "@/components/ncc/ncc-ui";
import type { NccMaintenanceModeSettings } from "@/lib/ncc/ncc-maintenance-types";
import {
  fetchNccControlPlaneOverview,
  fetchNccInstitutionImpact,
  fetchNccRiskPolicy,
  listNccControlInstitutions,
  listNccDocumentsPendingReview,
  listNccExceptionQueue,
  listNccFailedOutboxEvents,
  listNccFailedWebhookDeliveries,
  listNccLiquidityPending,
  listNccOperationalAlerts,
  listNccReconciliationMismatches,
  listNccReturnsQueue,
  listNccStaffMemberships,
  nccAcceptDocument,
  nccAcknowledgeAlert,
  nccApproveEmergencyResume,
  nccApproveLiquidity,
  nccApproveNetworkResume,
  nccApproveReturnExecution,
  nccAssignAlert,
  nccAssignStaff,
  nccDisableWebhookEndpoint,
  nccEmergencySuspendInstitution,
  nccFreezeSettlementAccount,
  nccInitiateCompensation,
  nccMarkDocumentUnderReview,
  nccRejectDocument,
  nccRejectLiquidity,
  nccRequestEmergencyResume,
  nccRequestLiquidity,
  nccRequestNetworkResume,
  nccRequeueOutboxEvent,
  nccResolveAlert,
  nccResolveReconciliation,
  nccRestrictInstitution,
  nccResumeInstitution,
  nccRetryException,
  nccRetryWebhookDelivery,
  nccReviewReturn,
  nccRevokeStaff,
  nccRerunReconciliation,
  nccRunReconciliationSweep,
  nccSetLiquidityThreshold,
  nccSetNetworkMode,
  nccSuspendInstitution,
  nccTerminateInstitution,
  nccTriggerSettlementWorkers,
  nccUnfreezeSettlementAccount,
  nccUpdateRiskPolicy,
  nccUpdateStaffRole,
  NCC_SENSITIVE_CONFIRMATION,
} from "@/lib/ncc/ncc-control-plane.functions";
import { cn } from "@/lib/utils";

type OverviewData = Awaited<ReturnType<typeof fetchNccControlPlaneOverview>>;

type SectionId =
  | "overview"
  | "institutions"
  | "network"
  | "exceptions"
  | "returns"
  | "compensation"
  | "liquidity"
  | "documents"
  | "reconciliation"
  | "outbox"
  | "risk"
  | "health"
  | "staff";

const SECTIONS: Array<{ id: SectionId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "institutions", label: "Institutions" },
  { id: "network", label: "Network" },
  { id: "exceptions", label: "Exceptions" },
  { id: "returns", label: "Returns" },
  { id: "compensation", label: "Compensation" },
  { id: "liquidity", label: "Liquidity" },
  { id: "documents", label: "Documents" },
  { id: "reconciliation", label: "Reconciliation" },
  { id: "outbox", label: "Outbox / Webhooks" },
  { id: "risk", label: "Risk limits" },
  { id: "health", label: "Health & alerts" },
  { id: "staff", label: "NCC staff" },
];

const STAFF_ROLES = [
  "VIEWER",
  "AUDITOR",
  "COMPLIANCE_ANALYST",
  "SETTLEMENT_OPERATOR",
  "LIQUIDITY_OPERATOR",
  "SENIOR_APPROVER",
  "NCC_ADMINISTRATOR",
  "EMERGENCY_ADMINISTRATOR",
] as const;

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message.replace(/^(BAD_REQUEST|FORBIDDEN):/, "");
  return "Action failed.";
}

function networkStatus(mode: string): NccStatus {
  if (mode === "ACTIVE") return "operational";
  if (mode === "PAUSE_NEW_SETTLEMENTS") return "warning";
  return "suspended";
}

function ModeBanner({ mode, reason }: { mode: string; reason: string | null }) {
  const tone =
    mode === "ACTIVE"
      ? "border-[#bbf7d0] bg-[#ecfdf3] text-[#15803d]"
      : mode === "PAUSE_NEW_SETTLEMENTS"
        ? "border-[#fef08a] bg-[#fefce8] text-[#a16207]"
        : "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]";
  return (
    <div className={cn("rounded-sm border px-4 py-3", tone)}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em]">Network mode</div>
      <div className="mt-1 text-[16px] font-semibold tracking-tight">{mode.replaceAll("_", " ")}</div>
      {reason ? <p className="mt-1 text-[13px] opacity-90">{reason}</p> : null}
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block text-[13px]", className)}>
      <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6b7280]">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-sm border border-[#e5e7eb] bg-white px-3 py-2 text-[13px] text-[#111827] outline-none focus:border-[#0c4d32]",
        props.className,
      )}
    />
  );
}

function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "w-full rounded-sm border border-[#e5e7eb] bg-white px-3 py-2 text-[13px] text-[#111827] outline-none focus:border-[#0c4d32]",
        props.className,
      )}
    />
  );
}

function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "w-full rounded-sm border border-[#e5e7eb] bg-white px-3 py-2 text-[13px] text-[#111827] outline-none focus:border-[#0c4d32]",
        props.className,
      )}
    />
  );
}

function SensitiveFields({
  reason,
  setReason,
  confirmation,
  setConfirmation,
}: {
  reason: string;
  setReason: (v: string) => void;
  confirmation: string;
  setConfirmation: (v: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Reason">
        <TextArea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <Field label={`Type "${NCC_SENSITIVE_CONFIRMATION}"`}>
        <TextInput
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={NCC_SENSITIVE_CONFIRMATION}
          autoComplete="off"
        />
      </Field>
    </div>
  );
}

function ActionResult({ error, ok }: { error: string | null; ok: string | null }) {
  if (!error && !ok) return null;
  return (
    <div
      className={cn(
        "mt-3 rounded-sm border px-3 py-2 text-[13px]",
        error
          ? "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]"
          : "border-[#bbf7d0] bg-[#ecfdf3] text-[#15803d]",
      )}
    >
      {error ?? ok}
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <p className="text-[13px] text-[#6b7280]">{label}</p>;
}

function LoadingRow() {
  return <p className="text-[13px] text-[#6b7280]">Loading…</p>;
}

export function NccAdminPage({
  maintenanceSettings,
  overview: initialOverview,
  accessDenied,
}: {
  maintenanceSettings: NccMaintenanceModeSettings | null;
  overview: OverviewData | null;
  accessDenied?: boolean;
}) {
  const [section, setSection] = useState<SectionId>("overview");
  const [overview, setOverview] = useState(initialOverview);
  const refreshOverviewFn = useServerFn(fetchNccControlPlaneOverview);

  const refreshOverview = useCallback(async () => {
    try {
      setOverview(await refreshOverviewFn());
    } catch {
      // keep prior overview
    }
  }, [refreshOverviewFn]);

  if (accessDenied || !overview || !maintenanceSettings) {
    return (
      <NccLayout>
        <NccPageContainer>
          <NccCard>
            <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6b7280]">
              Access denied
            </div>
            <h1 className="mt-2 text-xl font-semibold text-[#111827]">NCC staff required</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-[#6b7280]">
              This control plane is limited to active NCC staff with{" "}
              <code className="text-[12px]">view_control_plane</code> permission. Internal Alta
              platform access alone is not sufficient.
            </p>
          </NccCard>
        </NccPageContainer>
      </NccLayout>
    );
  }

  return (
    <NccLayout>
      <NccPageContainer wide>
        <div className="border-b border-[#e5e7eb] pb-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#6b7280]">
            Administration
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#111827]">
            NCC Staff Control Plane
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[#6b7280]">
            Network operations for authorized NCC staff. Sensitive actions require a typed reason and
            confirmation phrase.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-[12px] text-[#6b7280]">
            <span>
              Signed in as <span className="font-medium text-[#111827]">{overview.actor.role}</span>
            </span>
            <NccBadge status={networkStatus(overview.network.mode)} label={overview.network.mode} />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-1 border-b border-[#e5e7eb] pb-px">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={cn(
                "rounded-t-sm px-3 py-2 text-[12px] font-medium transition-colors",
                section === s.id
                  ? "bg-white text-[#0c4d32] shadow-[inset_0_-2px_0_0_#0c4d32]"
                  : "text-[#6b7280] hover:bg-[#f9fafb] hover:text-[#111827]",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="mt-8 space-y-8">
          {section === "overview" ? (
            <OverviewSection
              overview={overview}
              maintenanceSettings={maintenanceSettings}
              onRefresh={refreshOverview}
            />
          ) : null}
          {section === "institutions" ? <InstitutionsSection onChanged={refreshOverview} /> : null}
          {section === "network" ? (
            <NetworkSection overview={overview} onChanged={refreshOverview} />
          ) : null}
          {section === "exceptions" || section === "compensation" ? (
            <ExceptionsSection showCompensation={section === "compensation"} />
          ) : null}
          {section === "returns" ? <ReturnsSection /> : null}
          {section === "liquidity" ? <LiquiditySection /> : null}
          {section === "documents" ? <DocumentsSection /> : null}
          {section === "reconciliation" ? <ReconciliationSection /> : null}
          {section === "outbox" ? <OutboxSection /> : null}
          {section === "risk" ? <RiskSection /> : null}
          {section === "health" ? (
            <HealthSection overview={overview} onRefresh={refreshOverview} />
          ) : null}
          {section === "staff" ? <StaffSection actorRole={overview.actor.role} /> : null}
        </div>
      </NccPageContainer>
    </NccLayout>
  );
}

function OverviewSection({
  overview,
  maintenanceSettings,
  onRefresh,
}: {
  overview: OverviewData;
  maintenanceSettings: NccMaintenanceModeSettings;
  onRefresh: () => Promise<void>;
}) {
  const triggerWorkers = useServerFn(nccTriggerSettlementWorkers);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const m = overview.health.metrics;
  const w = overview.health.webhooks;

  return (
    <>
      <ModeBanner mode={overview.network.mode} reason={overview.network.reason} />

      <div className="grid gap-4 lg:grid-cols-3">
        <NccCard>
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6b7280]">
            Health summary
          </div>
          <ul className="mt-3 space-y-2 text-[13px] text-[#374151]">
            <li>Incomplete executions: {m.incompleteExecutions}</li>
            <li>Manual review: {m.manualReviewCount}</li>
            <li>Reconciliation mismatches: {m.reconciliationMismatchCount}</li>
            <li>Outbox backlog: {m.outboxBacklog}</li>
            <li>Webhook failed: {w.permanentlyFailedDeliveries}</li>
            <li>Low liquidity institutions: {m.institutionsBelowLiquidityThreshold}</li>
          </ul>
        </NccCard>
        <NccCard className="lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6b7280]">
                Production readiness
              </div>
              <div className="mt-2 flex items-center gap-2">
                <NccBadge
                  status={overview.readiness.ready ? "operational" : "suspended"}
                  label={overview.readiness.ready ? "Ready" : "Not ready"}
                />
                <span className="text-[12px] text-[#6b7280]">
                  Checked {new Date(overview.readiness.checkedAt).toLocaleString()}
                </span>
              </div>
            </div>
            <NccButton
              variant="secondary"
              onClick={async () => {
                setBusy(true);
                setError(null);
                setOk(null);
                try {
                  await triggerWorkers();
                  setOk("Settlement workers triggered.");
                  await onRefresh();
                } catch (e) {
                  setError(errMsg(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Triggering…" : "Trigger workers"}
            </NccButton>
          </div>
          {overview.readiness.blockers.length ? (
            <div className="mt-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#b91c1c]">
                Blockers
              </div>
              <ul className="mt-2 space-y-1 text-[13px] text-[#374151]">
                {overview.readiness.blockers.map((b) => (
                  <li key={b.code}>
                    <span className="font-medium">{b.code}</span> — {b.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-4 text-[13px] text-[#15803d]">No readiness blockers.</p>
          )}
          {overview.readiness.warnings.length ? (
            <div className="mt-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#a16207]">
                Warnings
              </div>
              <ul className="mt-2 space-y-1 text-[13px] text-[#374151]">
                {overview.readiness.warnings.map((b) => (
                  <li key={b.code}>
                    <span className="font-medium">{b.code}</span> — {b.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <ActionResult error={error} ok={ok} />
        </NccCard>
      </div>

      <NccMaintenanceModePanel initial={maintenanceSettings} />
    </>
  );
}

function InstitutionsSection({ onChanged }: { onChanged: () => Promise<void> }) {
  const listFn = useServerFn(listNccControlInstitutions);
  const impactFn = useServerFn(fetchNccInstitutionImpact);
  const restrictFn = useServerFn(nccRestrictInstitution);
  const suspendFn = useServerFn(nccSuspendInstitution);
  const resumeFn = useServerFn(nccResumeInstitution);
  const terminateFn = useServerFn(nccTerminateInstitution);
  const emergencyFn = useServerFn(nccEmergencySuspendInstitution);
  const requestResumeFn = useServerFn(nccRequestEmergencyResume);
  const approveResumeFn = useServerFn(nccApproveEmergencyResume);

  const [rows, setRows] = useState<Awaited<ReturnType<typeof listNccControlInstitutions>>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [impact, setImpact] = useState<Awaited<ReturnType<typeof fetchNccInstitutionImpact>> | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listFn({ data: {} }));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [listFn]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!selectedId) {
      setImpact(null);
      return;
    }
    void impactFn({ data: { institutionId: selectedId } })
      .then(setImpact)
      .catch((e) => setError(errMsg(e)));
  }, [selectedId, impactFn]);

  async function run(action: () => Promise<unknown>, label: string) {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await action();
      setOk(label);
      setReason("");
      setConfirmation("");
      await reload();
      if (selectedId) setImpact(await impactFn({ data: { institutionId: selectedId } }));
      await onChanged();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <NccCard>
        <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6b7280]">
          Institutions
        </div>
        {loading ? <LoadingRow /> : null}
        {!loading && !rows.length ? <EmptyRow label="No NCC participant institutions." /> : null}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#e5e7eb] text-[11px] uppercase tracking-[0.1em] text-[#6b7280]">
                <th className="py-2 pr-3">Institution</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Alta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={cn(
                    "cursor-pointer border-b border-[#f3f4f6]",
                    selectedId === r.id && "bg-[#f0fdf4]",
                  )}
                  onClick={() => setSelectedId(r.id)}
                >
                  <td className="py-2.5 pr-3 font-medium text-[#111827]">{r.displayName}</td>
                  <td className="py-2.5 pr-3">{r.status}</td>
                  <td className="py-2.5">{r.isAlta ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </NccCard>

      {impact ? (
        <NccCard>
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6b7280]">
            Impact preview — {impact.institution.displayName}
          </div>
          <ul className="mt-3 grid gap-2 text-[13px] text-[#374151] sm:grid-cols-2">
            <li>Status: {impact.institution.status}</li>
            <li>In-flight settlements: {impact.inFlightSettlements.count}</li>
            <li>Routing numbers: {impact.routingNumbers.length}</li>
            <li>Settlement accounts: {impact.settlementAccounts.length}</li>
            <li>Credentials: {impact.credentials.length}</li>
            <li>Webhooks: {impact.webhooks.length}</li>
            <li>
              Emergency suspension:{" "}
              {impact.activeEmergencySuspension
                ? impact.activeEmergencySuspension.id
                : "None"}
            </li>
          </ul>

          <div className="mt-5">
            <SensitiveFields
              reason={reason}
              setReason={setReason}
              confirmation={confirmation}
              setConfirmation={setConfirmation}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <NccButton
              variant="secondary"
              onClick={() =>
                run(
                  () =>
                    restrictFn({
                      data: { institutionId: selectedId, reason, confirmation },
                    }),
                  "Institution restricted.",
                )
              }
            >
              Restrict
            </NccButton>
            <NccButton
              variant="secondary"
              onClick={() =>
                run(
                  () =>
                    suspendFn({
                      data: { institutionId: selectedId, reason, confirmation },
                    }),
                  "Institution suspended.",
                )
              }
            >
              Suspend
            </NccButton>
            <NccButton
              variant="secondary"
              onClick={() =>
                run(
                  () =>
                    resumeFn({
                      data: { institutionId: selectedId, reason, confirmation },
                    }),
                  "Institution resumed.",
                )
              }
            >
              Resume
            </NccButton>
            <NccButton
              variant="secondary"
              onClick={() =>
                run(
                  () =>
                    terminateFn({
                      data: { institutionId: selectedId, reason, confirmation },
                    }),
                  "Institution terminated.",
                )
              }
            >
              Terminate
            </NccButton>
            <NccButton
              onClick={() =>
                run(
                  () =>
                    emergencyFn({
                      data: { institutionId: selectedId, reason, confirmation },
                    }),
                  "Emergency suspension applied.",
                )
              }
            >
              Emergency suspend
            </NccButton>
            {impact.activeEmergencySuspension ? (
              <>
                <NccButton
                  variant="secondary"
                  onClick={() =>
                    run(
                      () =>
                        requestResumeFn({
                          data: {
                            suspensionId: impact.activeEmergencySuspension!.id,
                            reason,
                            confirmation,
                          },
                        }),
                      "Emergency resume requested.",
                    )
                  }
                >
                  Request emergency resume
                </NccButton>
                <NccButton
                  variant="secondary"
                  onClick={() =>
                    run(
                      () =>
                        approveResumeFn({
                          data: {
                            suspensionId: impact.activeEmergencySuspension!.id,
                            confirmation,
                          },
                        }),
                      "Emergency resume approved.",
                    )
                  }
                >
                  Approve emergency resume
                </NccButton>
              </>
            ) : null}
          </div>
          {busy ? <p className="mt-3 text-[12px] text-[#6b7280]">Working…</p> : null}
          <ActionResult error={error} ok={ok} />
        </NccCard>
      ) : null}
    </div>
  );
}

function NetworkSection({
  overview,
  onChanged,
}: {
  overview: OverviewData;
  onChanged: () => Promise<void>;
}) {
  const setModeFn = useServerFn(nccSetNetworkMode);
  const requestFn = useServerFn(nccRequestNetworkResume);
  const approveFn = useServerFn(nccApproveNetworkResume);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>, label: string) {
    setError(null);
    setOk(null);
    try {
      await action();
      setOk(label);
      setReason("");
      setConfirmation("");
      await onChanged();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  return (
    <div className="space-y-6">
      <ModeBanner mode={overview.network.mode} reason={overview.network.reason} />
      {overview.network.pendingResumeRequestedByUserId ? (
        <NccCard>
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#a16207]">
            Pending dual-control resume
          </div>
          <p className="mt-2 text-[13px] text-[#374151]">
            Requested by {overview.network.pendingResumeRequestedByUserId}
            {overview.network.pendingResumeReason
              ? ` — ${overview.network.pendingResumeReason}`
              : ""}
          </p>
          <p className="mt-2 text-[12px] text-[#6b7280]">
            Approver must be a different staff member than the requester.
          </p>
        </NccCard>
      ) : null}
      <NccCard>
        <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6b7280]">
          Network controls
        </div>
        <div className="mt-4">
          <SensitiveFields
            reason={reason}
            setReason={setReason}
            confirmation={confirmation}
            setConfirmation={setConfirmation}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <NccButton
            variant="secondary"
            onClick={() =>
              run(
                () =>
                  setModeFn({
                    data: {
                      mode: "PAUSE_NEW_SETTLEMENTS",
                      reason,
                      confirmation,
                    },
                  }),
                "New settlements paused.",
              )
            }
          >
            Pause new settlements
          </NccButton>
          <NccButton
            onClick={() =>
              run(
                () =>
                  setModeFn({
                    data: { mode: "EMERGENCY_STOP", reason, confirmation },
                  }),
                "Emergency stop active.",
              )
            }
          >
            Emergency stop
          </NccButton>
          <NccButton
            variant="secondary"
            onClick={() =>
              run(
                () => requestFn({ data: { reason, confirmation } }),
                "Resume requested (awaiting second approver).",
              )
            }
          >
            Request resume
          </NccButton>
          <NccButton
            variant="secondary"
            onClick={() =>
              run(
                () => approveFn({ data: { confirmation } }),
                "Network resumed to ACTIVE.",
              )
            }
          >
            Approve resume
          </NccButton>
        </div>
        <ActionResult error={error} ok={ok} />
      </NccCard>
    </div>
  );
}

function ExceptionsSection({ showCompensation }: { showCompensation: boolean }) {
  const listFn = useServerFn(listNccExceptionQueue);
  const retryFn = useServerFn(nccRetryException);
  const compensateFn = useServerFn(nccInitiateCompensation);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listNccExceptionQueue>>>([]);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listFn({ data: {} }));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [listFn]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <NccCard>
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6b7280]">
        {showCompensation ? "Compensation" : "Settlement exceptions"}
      </div>
      {showCompensation ? (
        <p className="mt-2 text-[13px] text-[#6b7280]">
          Initiate eligible post-ledger compensation from failed / compensating executions. Dual
          confirmation required.
        </p>
      ) : null}
      {loading ? <LoadingRow /> : null}
      {!loading && !rows.length ? <EmptyRow label="Exception queue is empty." /> : null}
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-sm border border-[#e5e7eb] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium text-[#111827]">
                  {row.instruction?.publicReference ?? row.settlementInstructionId}
                </div>
                <div className="text-[12px] text-[#6b7280]">
                  {row.status}
                  {row.instruction
                    ? ` · ${row.instruction.amount} ${row.instruction.currency}`
                    : ""}
                  {row.failureCode ? ` · ${row.failureCode}` : ""}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {!showCompensation ? (
                  <NccButton
                    variant="secondary"
                    onClick={async () => {
                      setError(null);
                      try {
                        await retryFn({ data: { executionId: row.id } });
                        setOk("Retry scheduled.");
                        await reload();
                      } catch (e) {
                        setError(errMsg(e));
                      }
                    }}
                  >
                    Retry now
                  </NccButton>
                ) : null}
                <NccButton
                  variant={showCompensation ? "primary" : "secondary"}
                  onClick={async () => {
                    setError(null);
                    setOk(null);
                    try {
                      await compensateFn({
                        data: {
                          instructionId: row.settlementInstructionId,
                          reason,
                          confirmation,
                        },
                      });
                      setOk("Compensation initiated.");
                      setReason("");
                      setConfirmation("");
                      await reload();
                    } catch (e) {
                      setError(errMsg(e));
                    }
                  }}
                >
                  Compensate
                </NccButton>
              </div>
            </div>
          </div>
        ))}
      </div>
      {(showCompensation || rows.length > 0) && (
        <div className="mt-5">
          <SensitiveFields
            reason={reason}
            setReason={setReason}
            confirmation={confirmation}
            setConfirmation={setConfirmation}
          />
        </div>
      )}
      <ActionResult error={error} ok={ok} />
    </NccCard>
  );
}

function ReturnsSection() {
  const listFn = useServerFn(listNccReturnsQueue);
  const reviewFn = useServerFn(nccReviewReturn);
  const approveExecFn = useServerFn(nccApproveReturnExecution);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listNccReturnsQueue>>>([]);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listFn({ data: {} }));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [listFn]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <NccCard>
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6b7280]">
        Transfer returns
      </div>
      <p className="mt-2 text-[13px] text-[#6b7280]">
        Review and dual-control execution approval. Execution approver must differ from reviewer.
      </p>
      {loading ? <LoadingRow /> : null}
      {!loading && !rows.length ? <EmptyRow label="No open returns." /> : null}
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-sm border border-[#e5e7eb] p-3">
            <div className="font-medium text-[#111827]">{row.publicReference}</div>
            <div className="text-[12px] text-[#6b7280]">
              {row.status} · {row.amount} {row.currency} · {row.reason}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <NccButton
                variant="secondary"
                onClick={async () => {
                  try {
                    await reviewFn({
                      data: { returnId: row.id, decision: "approve", confirmation },
                    });
                    setOk("Return approved for execution path.");
                    await reload();
                  } catch (e) {
                    setError(errMsg(e));
                  }
                }}
              >
                Review approve
              </NccButton>
              <NccButton
                variant="secondary"
                onClick={async () => {
                  try {
                    await reviewFn({
                      data: { returnId: row.id, decision: "reject", confirmation, note: reason },
                    });
                    setOk("Return rejected.");
                    await reload();
                  } catch (e) {
                    setError(errMsg(e));
                  }
                }}
              >
                Reject
              </NccButton>
              <NccButton
                onClick={async () => {
                  try {
                    await approveExecFn({
                      data: { returnId: row.id, reason, confirmation },
                    });
                    setOk("Execution approved and started.");
                    await reload();
                  } catch (e) {
                    setError(errMsg(e));
                  }
                }}
              >
                Approve execution
              </NccButton>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5">
        <SensitiveFields
          reason={reason}
          setReason={setReason}
          confirmation={confirmation}
          setConfirmation={setConfirmation}
        />
      </div>
      <ActionResult error={error} ok={ok} />
    </NccCard>
  );
}

function LiquiditySection() {
  const listFn = useServerFn(listNccLiquidityPending);
  const requestFn = useServerFn(nccRequestLiquidity);
  const approveFn = useServerFn(nccApproveLiquidity);
  const rejectFn = useServerFn(nccRejectLiquidity);
  const thresholdFn = useServerFn(nccSetLiquidityThreshold);
  const freezeFn = useServerFn(nccFreezeSettlementAccount);
  const unfreezeFn = useServerFn(nccUnfreezeSettlementAccount);

  const [rows, setRows] = useState<Awaited<ReturnType<typeof listNccLiquidityPending>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [opType, setOpType] = useState<
    "FUNDING" | "WITHDRAWAL" | "AUTHORIZED_CORRECTION" | "OPENING_BALANCE_AUTHORIZATION"
  >("FUNDING");
  const [requestReason, setRequestReason] = useState("");
  const [threshold, setThreshold] = useState("");
  const [freezeReason, setFreezeReason] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listFn({ data: {} }));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [listFn]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="space-y-6">
      <NccCard>
        <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6b7280]">
          Pending liquidity operations
        </div>
        <p className="mt-2 text-[13px] text-[#6b7280]">
          Approver must be a different staff member than the requester (self-approval denied).
        </p>
        {loading ? <LoadingRow /> : null}
        {!loading && !rows.length ? <EmptyRow label="No pending liquidity operations." /> : null}
        <div className="mt-4 space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-sm border border-[#e5e7eb] p-3">
              <div className="font-medium text-[#111827]">
                {row.institutionName} · {row.operationType}
              </div>
              <div className="text-[12px] text-[#6b7280]">
                {row.amount} {row.currency} · requested by {row.requestedByUserId}
              </div>
              <p className="mt-1 text-[13px] text-[#374151]">{row.reason}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <NccButton
                  onClick={async () => {
                    try {
                      await approveFn({ data: { operationId: row.id } });
                      setOk("Liquidity operation approved and applied.");
                      await reload();
                    } catch (e) {
                      setError(errMsg(e));
                    }
                  }}
                >
                  Approve
                </NccButton>
                <NccButton
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await rejectFn({
                        data: { operationId: row.id, reason: rejectReason || "Rejected by staff" },
                      });
                      setOk("Liquidity operation rejected.");
                      await reload();
                    } catch (e) {
                      setError(errMsg(e));
                    }
                  }}
                >
                  Reject
                </NccButton>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Field label="Reject reason">
            <TextInput value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
          </Field>
        </div>
      </NccCard>

      <NccCard>
        <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6b7280]">
          Request / threshold / freeze
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Settlement account ID">
            <TextInput value={accountId} onChange={(e) => setAccountId(e.target.value)} />
          </Field>
          <Field label="Amount">
            <TextInput value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Operation type">
            <Select
              value={opType}
              onChange={(e) => setOpType(e.target.value as typeof opType)}
            >
              <option value="FUNDING">FUNDING</option>
              <option value="WITHDRAWAL">WITHDRAWAL</option>
              <option value="AUTHORIZED_CORRECTION">AUTHORIZED_CORRECTION</option>
              <option value="OPENING_BALANCE_AUTHORIZATION">OPENING_BALANCE_AUTHORIZATION</option>
            </Select>
          </Field>
          <Field label="Request reason">
            <TextInput value={requestReason} onChange={(e) => setRequestReason(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <NccButton
            onClick={async () => {
              try {
                await requestFn({
                  data: {
                    settlementAccountId: accountId,
                    amount,
                    operationType: opType,
                    reason: requestReason,
                    idempotencyKey: `ui-${crypto.randomUUID()}`,
                  },
                });
                setOk("Liquidity request submitted (awaiting distinct approver).");
                await reload();
              } catch (e) {
                setError(errMsg(e));
              }
            }}
          >
            Request operation
          </NccButton>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Field label="Low-liquidity threshold">
            <TextInput value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          </Field>
          <Field label="Freeze / unfreeze reason">
            <TextInput value={freezeReason} onChange={(e) => setFreezeReason(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <NccButton
            variant="secondary"
            onClick={async () => {
              try {
                await thresholdFn({
                  data: {
                    settlementAccountId: accountId,
                    threshold: threshold === "" ? null : threshold,
                  },
                });
                setOk("Threshold updated.");
              } catch (e) {
                setError(errMsg(e));
              }
            }}
          >
            Set threshold
          </NccButton>
          <NccButton
            variant="secondary"
            onClick={async () => {
              try {
                await freezeFn({
                  data: { settlementAccountId: accountId, reason: freezeReason },
                });
                setOk("Account frozen.");
              } catch (e) {
                setError(errMsg(e));
              }
            }}
          >
            Freeze
          </NccButton>
          <NccButton
            variant="secondary"
            onClick={async () => {
              try {
                await unfreezeFn({
                  data: { settlementAccountId: accountId, reason: freezeReason },
                });
                setOk("Account unfrozen.");
              } catch (e) {
                setError(errMsg(e));
              }
            }}
          >
            Unfreeze
          </NccButton>
        </div>
        <ActionResult error={error} ok={ok} />
      </NccCard>
    </div>
  );
}

function DocumentsSection() {
  const listFn = useServerFn(listNccDocumentsPendingReview);
  const underReviewFn = useServerFn(nccMarkDocumentUnderReview);
  const acceptFn = useServerFn(nccAcceptDocument);
  const rejectFn = useServerFn(nccRejectDocument);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listNccDocumentsPendingReview>>>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listFn({ data: {} }));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [listFn]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <NccCard>
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6b7280]">
        Regulatory documents pending review
      </div>
      {loading ? <LoadingRow /> : null}
      {!loading && !rows.length ? <EmptyRow label="No documents pending review." /> : null}
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-sm border border-[#e5e7eb] p-3">
            <div className="font-medium text-[#111827]">
              {row.documentType} · {row.originalFileName}
            </div>
            <div className="text-[12px] text-[#6b7280]">
              {row.status} · {row.institutionName ?? row.institutionId ?? "—"} · v
              {row.versionNumber}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <NccButton
                variant="secondary"
                onClick={async () => {
                  try {
                    await underReviewFn({ data: { documentId: row.id, note } });
                    setOk("Marked under review.");
                    await reload();
                  } catch (e) {
                    setError(errMsg(e));
                  }
                }}
              >
                Under review
              </NccButton>
              <NccButton
                onClick={async () => {
                  try {
                    await acceptFn({
                      data: {
                        documentId: row.id,
                        reviewNote: note || null,
                        manualSafeReviewCompleted: row.status === "PENDING_SCAN",
                      },
                    });
                    setOk("Document accepted.");
                    await reload();
                  } catch (e) {
                    setError(errMsg(e));
                  }
                }}
              >
                Accept
              </NccButton>
              <NccButton
                variant="secondary"
                onClick={async () => {
                  try {
                    await rejectFn({
                      data: { documentId: row.id, reviewNote: note || "Rejected by staff" },
                    });
                    setOk("Document rejected.");
                    await reload();
                  } catch (e) {
                    setError(errMsg(e));
                  }
                }}
              >
                Reject
              </NccButton>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <Field label="Review note">
          <TextArea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      <ActionResult error={error} ok={ok} />
    </NccCard>
  );
}

function ReconciliationSection() {
  const listFn = useServerFn(listNccReconciliationMismatches);
  const resolveFn = useServerFn(nccResolveReconciliation);
  const rerunFn = useServerFn(nccRerunReconciliation);
  const sweepFn = useServerFn(nccRunReconciliationSweep);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listNccReconciliationMismatches>>>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [instructionId, setInstructionId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listFn({ data: {} }));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [listFn]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <NccCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6b7280]">
            Reconciliation mismatches
          </div>
          <p className="mt-2 text-[13px] text-[#6b7280]">
            Resolve retains findings; resolution note is required.
          </p>
        </div>
        <NccButton
          variant="secondary"
          onClick={async () => {
            try {
              const result = await sweepFn({ data: {} });
              setOk(`Sweep complete (${result.count} instructions).`);
              await reload();
            } catch (e) {
              setError(errMsg(e));
            }
          }}
        >
          Run sweep
        </NccButton>
      </div>
      {loading ? <LoadingRow /> : null}
      {!loading && !rows.length ? <EmptyRow label="No open mismatches." /> : null}
      <div className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-sm border border-[#e5e7eb] p-3">
            <div className="font-medium text-[#111827]">
              {row.instruction?.publicReference ?? row.settlementInstructionId}
            </div>
            <div className="text-[12px] text-[#6b7280]">{row.status}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <NccButton
                variant="secondary"
                onClick={async () => {
                  try {
                    await resolveFn({ data: { id: row.id, note: note || "Resolved by staff" } });
                    setOk("Reconciliation resolved.");
                    await reload();
                  } catch (e) {
                    setError(errMsg(e));
                  }
                }}
              >
                Resolve
              </NccButton>
              <NccButton
                variant="secondary"
                onClick={async () => {
                  try {
                    await rerunFn({
                      data: { instructionId: row.settlementInstructionId },
                    });
                    setOk("Reconciliation re-run.");
                    await reload();
                  } catch (e) {
                    setError(errMsg(e));
                  }
                }}
              >
                Re-run
              </NccButton>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Resolution note">
          <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <Field label="Rerun by instruction ID">
          <div className="flex gap-2">
            <TextInput value={instructionId} onChange={(e) => setInstructionId(e.target.value)} />
            <NccButton
              variant="secondary"
              onClick={async () => {
                try {
                  await rerunFn({ data: { instructionId } });
                  setOk("Reconciliation re-run.");
                  await reload();
                } catch (e) {
                  setError(errMsg(e));
                }
              }}
            >
              Run
            </NccButton>
          </div>
        </Field>
      </div>
      <ActionResult error={error} ok={ok} />
    </NccCard>
  );
}

function OutboxSection() {
  const outboxFn = useServerFn(listNccFailedOutboxEvents);
  const webhookFn = useServerFn(listNccFailedWebhookDeliveries);
  const requeueFn = useServerFn(nccRequeueOutboxEvent);
  const retryWebhookFn = useServerFn(nccRetryWebhookDelivery);
  const disableFn = useServerFn(nccDisableWebhookEndpoint);
  const [outbox, setOutbox] = useState<Awaited<ReturnType<typeof listNccFailedOutboxEvents>>>([]);
  const [webhooks, setWebhooks] = useState<
    Awaited<ReturnType<typeof listNccFailedWebhookDeliveries>>
  >([]);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [o, w] = await Promise.all([outboxFn({ data: {} }), webhookFn({ data: {} })]);
      setOutbox(o);
      setWebhooks(w);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [outboxFn, webhookFn]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="space-y-6">
      <NccCard>
        <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6b7280]">
          Failed outbox events
        </div>
        {loading ? <LoadingRow /> : null}
        {!loading && !outbox.length ? <EmptyRow label="No failed outbox events." /> : null}
        <div className="mt-4 space-y-3">
          {outbox.map((row) => (
            <div
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-[#e5e7eb] p-3"
            >
              <div>
                <div className="font-medium text-[#111827]">{row.eventType}</div>
                <div className="text-[12px] text-[#6b7280]">
                  {row.attempts}/{row.maxAttempts} · {row.lastError ?? "—"}
                </div>
              </div>
              <NccButton
                variant="secondary"
                onClick={async () => {
                  try {
                    await requeueFn({ data: { id: row.id } });
                    setOk("Outbox event requeued.");
                    await reload();
                  } catch (e) {
                    setError(errMsg(e));
                  }
                }}
              >
                Requeue
              </NccButton>
            </div>
          ))}
        </div>
      </NccCard>

      <NccCard>
        <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6b7280]">
          Failed / retrying webhooks
        </div>
        {!loading && !webhooks.length ? <EmptyRow label="No failed webhook deliveries." /> : null}
        <div className="mt-4 space-y-3">
          {webhooks.map((row) => (
            <div key={row.id} className="rounded-sm border border-[#e5e7eb] p-3">
              <div className="font-medium text-[#111827]">{row.endpoint.name}</div>
              <div className="text-[12px] text-[#6b7280]">
                {row.status} · attempts {row.attemptCount}/{row.maxAttempts} ·{" "}
                {row.lastErrorCode ?? "—"}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <NccButton
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await retryWebhookFn({
                        data: {
                          institutionId: row.endpoint.institutionId,
                          deliveryId: row.id,
                        },
                      });
                      setOk("Webhook redelivery requested.");
                      await reload();
                    } catch (e) {
                      setError(errMsg(e));
                    }
                  }}
                >
                  Retry delivery
                </NccButton>
                <NccButton
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await disableFn({
                        data: {
                          institutionId: row.endpoint.institutionId,
                          endpointId: row.endpoint.id,
                          reason,
                          confirmation,
                        },
                      });
                      setOk("Webhook endpoint disabled.");
                      await reload();
                    } catch (e) {
                      setError(errMsg(e));
                    }
                  }}
                >
                  Disable endpoint
                </NccButton>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5">
          <SensitiveFields
            reason={reason}
            setReason={setReason}
            confirmation={confirmation}
            setConfirmation={setConfirmation}
          />
        </div>
        <ActionResult error={error} ok={ok} />
      </NccCard>
    </div>
  );
}

function RiskSection() {
  const listInstitutionsFn = useServerFn(listNccControlInstitutions);
  const policyFn = useServerFn(fetchNccRiskPolicy);
  const updateFn = useServerFn(nccUpdateRiskPolicy);
  const [institutions, setInstitutions] = useState<
    Awaited<ReturnType<typeof listNccControlInstitutions>>
  >([]);
  const [institutionId, setInstitutionId] = useState("");
  const [maxTransfer, setMaxTransfer] = useState("");
  const [dailyAmount, setDailyAmount] = useState("");
  const [dailyCount, setDailyCount] = useState("");
  const [manualReview, setManualReview] = useState("");
  const [emergencyZero, setEmergencyZero] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    void listInstitutionsFn({ data: {} })
      .then((rows) => {
        setInstitutions(rows);
        if (rows[0]) setInstitutionId(rows[0].id);
      })
      .catch((e) => setError(errMsg(e)));
  }, [listInstitutionsFn]);

  useEffect(() => {
    if (!institutionId) return;
    void policyFn({ data: { institutionId } })
      .then((p) => {
        setMaxTransfer(p.maxTransferAmount ?? "");
        setDailyAmount(p.dailyAmountLimit ?? "");
        setDailyCount(p.dailyTransactionCountLimit?.toString() ?? "");
        setManualReview(p.manualReviewThreshold ?? "");
        setEmergencyZero(p.emergencyZeroLimit);
        setReason(p.reason ?? "");
      })
      .catch((e) => setError(errMsg(e)));
  }, [institutionId, policyFn]);

  return (
    <NccCard>
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6b7280]">
        Risk limits
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Institution">
          <Select value={institutionId} onChange={(e) => setInstitutionId(e.target.value)}>
            {institutions.map((i) => (
              <option key={i.id} value={i.id}>
                {i.displayName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Max transfer amount">
          <TextInput value={maxTransfer} onChange={(e) => setMaxTransfer(e.target.value)} />
        </Field>
        <Field label="Daily amount limit">
          <TextInput value={dailyAmount} onChange={(e) => setDailyAmount(e.target.value)} />
        </Field>
        <Field label="Daily transaction count">
          <TextInput value={dailyCount} onChange={(e) => setDailyCount(e.target.value)} />
        </Field>
        <Field label="Manual review threshold">
          <TextInput value={manualReview} onChange={(e) => setManualReview(e.target.value)} />
        </Field>
        <Field label="Reason">
          <TextInput value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
      <label className="mt-4 flex items-center gap-2 text-[13px] text-[#374151]">
        <input
          type="checkbox"
          checked={emergencyZero}
          onChange={(e) => setEmergencyZero(e.target.checked)}
        />
        Emergency zero limit
      </label>
      <div className="mt-4">
        <NccButton
          onClick={async () => {
            try {
              await updateFn({
                data: {
                  institutionId,
                  maxTransferAmount: maxTransfer || null,
                  dailyAmountLimit: dailyAmount || null,
                  dailyTransactionCountLimit: dailyCount ? Number(dailyCount) : null,
                  manualReviewThreshold: manualReview || null,
                  emergencyZeroLimit: emergencyZero,
                  reason,
                },
              });
              setOk("Risk policy updated.");
            } catch (e) {
              setError(errMsg(e));
            }
          }}
        >
          Update policy
        </NccButton>
      </div>
      <ActionResult error={error} ok={ok} />
    </NccCard>
  );
}

function HealthSection({
  overview,
  onRefresh,
}: {
  overview: OverviewData;
  onRefresh: () => Promise<void>;
}) {
  const listFn = useServerFn(listNccOperationalAlerts);
  const ackFn = useServerFn(nccAcknowledgeAlert);
  const resolveFn = useServerFn(nccResolveAlert);
  const assignFn = useServerFn(nccAssignAlert);
  const [alerts, setAlerts] = useState<Awaited<ReturnType<typeof listNccOperationalAlerts>>>([]);
  const [assignUserId, setAssignUserId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setAlerts(await listFn({ data: {} }));
    } catch (e) {
      setError(errMsg(e));
    }
  }, [listFn]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const metrics = useMemo(() => overview.health.metrics, [overview.health.metrics]);

  return (
    <div className="space-y-6">
      <NccCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6b7280]">
            Integration health
          </div>
          <NccButton variant="secondary" onClick={() => void onRefresh()}>
            Refresh
          </NccButton>
        </div>
        <ul className="mt-3 grid gap-2 text-[13px] text-[#374151] sm:grid-cols-2 lg:grid-cols-3">
          <li>Incomplete: {metrics.incompleteExecutions}</li>
          <li>Manual review: {metrics.manualReviewCount}</li>
          <li>Retry pending: {metrics.retryPendingCount}</li>
          <li>Compensation backlog: {metrics.compensationBacklog}</li>
          <li>Outbox backlog: {metrics.outboxBacklog}</li>
          <li>Webhook pending: {overview.health.webhooks.pendingDeliveries}</li>
          <li>API auth failures 24h: {overview.health.api.authFailures24h}</li>
          <li>Connectors failing: {overview.health.connectors.failing}</li>
          <li>
            Worker last success:{" "}
            {overview.health.workers.settlement.lastSuccessAt
              ? new Date(overview.health.workers.settlement.lastSuccessAt).toLocaleString()
              : "—"}
          </li>
        </ul>
      </NccCard>

      <NccCard>
        <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6b7280]">
          Open alerts
        </div>
        {!alerts.length ? <EmptyRow label="No open alerts." /> : null}
        <div className="mt-4 space-y-3">
          {alerts.map((alert) => (
            <div key={alert.id} className="rounded-sm border border-[#e5e7eb] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-[#111827]">{alert.title}</span>
                <NccBadge
                  status={alert.severity === "CRITICAL" ? "suspended" : "warning"}
                  label={alert.severity}
                />
                <span className="text-[12px] text-[#6b7280]">{alert.status}</span>
              </div>
              {alert.detail ? (
                <p className="mt-1 text-[13px] text-[#4b5563]">{alert.detail}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <NccButton
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await ackFn({ data: { alertId: alert.id } });
                      setOk("Alert acknowledged.");
                      await reload();
                    } catch (e) {
                      setError(errMsg(e));
                    }
                  }}
                >
                  Acknowledge
                </NccButton>
                <NccButton
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await resolveFn({ data: { alertId: alert.id, note: note || undefined } });
                      setOk("Alert resolved.");
                      await reload();
                    } catch (e) {
                      setError(errMsg(e));
                    }
                  }}
                >
                  Resolve
                </NccButton>
                <NccButton
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await assignFn({
                        data: {
                          alertId: alert.id,
                          assignedToUserId: assignUserId || null,
                        },
                      });
                      setOk("Alert assignment updated.");
                      await reload();
                    } catch (e) {
                      setError(errMsg(e));
                    }
                  }}
                >
                  Assign
                </NccButton>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Assign to user ID">
            <TextInput value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} />
          </Field>
          <Field label="Resolve note">
            <TextInput value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>
        <ActionResult error={error} ok={ok} />
      </NccCard>
    </div>
  );
}

function StaffSection({ actorRole }: { actorRole: string }) {
  const listFn = useServerFn(listNccStaffMemberships);
  const assignFn = useServerFn(nccAssignStaff);
  const updateFn = useServerFn(nccUpdateStaffRole);
  const revokeFn = useServerFn(nccRevokeStaff);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listNccStaffMemberships>>>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<(typeof STAFF_ROLES)[number]>("VIEWER");
  const [reason, setReason] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const canManage = actorRole === "NCC_ADMINISTRATOR" || actorRole === "EMERGENCY_ADMINISTRATOR";

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listFn());
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [listFn]);

  useEffect(() => {
    if (canManage) void reload();
  }, [canManage, reload]);

  if (!canManage) {
    return (
      <NccCard>
        <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6b7280]">
          NCC staff access
        </div>
        <p className="mt-3 text-[14px] text-[#6b7280]">
          Assigning and revoking staff memberships requires an NCC administrator role.
        </p>
      </NccCard>
    );
  }

  return (
    <NccCard>
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6b7280]">
        NCC staff memberships
      </div>
      {loading ? <LoadingRow /> : null}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-[#e5e7eb] text-[11px] uppercase tracking-[0.1em] text-[#6b7280]">
              <th className="py-2 pr-3">User</th>
              <th className="py-2 pr-3">Role</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-[#f3f4f6]">
                <td className="py-2.5 pr-3">
                  <div className="font-medium text-[#111827]">
                    {row.user?.discordUsername ?? row.userId}
                  </div>
                  <div className="text-[12px] text-[#6b7280]">{row.userId}</div>
                </td>
                <td className="py-2.5 pr-3">{row.role}</td>
                <td className="py-2.5">
                  <NccButton
                    variant="ghost"
                    onClick={async () => {
                      try {
                        await revokeFn({
                          data: { userId: row.userId, reason, confirmation },
                        });
                        setOk("Staff membership revoked.");
                        await reload();
                      } catch (e) {
                        setError(errMsg(e));
                      }
                    }}
                  >
                    Revoke
                  </NccButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Field label="User ID">
          <TextInput value={userId} onChange={(e) => setUserId(e.target.value)} />
        </Field>
        <Field label="Role">
          <Select
            value={role}
            onChange={(e) => setRole(e.target.value as (typeof STAFF_ROLES)[number])}
          >
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="mt-4">
        <SensitiveFields
          reason={reason}
          setReason={setReason}
          confirmation={confirmation}
          setConfirmation={setConfirmation}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <NccButton
          onClick={async () => {
            try {
              await assignFn({ data: { userId, role, reason, confirmation } });
              setOk("Staff assigned.");
              await reload();
            } catch (e) {
              setError(errMsg(e));
            }
          }}
        >
          Assign
        </NccButton>
        <NccButton
          variant="secondary"
          onClick={async () => {
            try {
              await updateFn({ data: { userId, role, reason, confirmation } });
              setOk("Staff role updated.");
              await reload();
            } catch (e) {
              setError(errMsg(e));
            }
          }}
        >
          Update role
        </NccButton>
      </div>
      <ActionResult error={error} ok={ok} />
    </NccCard>
  );
}
