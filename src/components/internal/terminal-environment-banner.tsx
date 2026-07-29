import type { TerminalOpsEnvironmentStatus } from "@/lib/terminal/terminal-ops-environment";

/** Single environment indicator for Terminal ops — avoid repeating on every card. */
export function TerminalEnvironmentBanner({
  environment,
  compact = false,
}: {
  environment: TerminalOpsEnvironmentStatus;
  /** Home uses compact copy; System can show technical details. */
  compact?: boolean;
}) {
  const tone =
    environment.connectionState === "mock"
      ? "border-amber-500/40 bg-amber-500/5 text-amber-900 dark:text-amber-100"
      : environment.connectionState === "live"
        ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-900 dark:text-emerald-100"
        : "border-rose-500/40 bg-rose-500/5 text-rose-900 dark:text-rose-100";

  const headline =
    environment.connectionState === "mock" || environment.isDemonstration
      ? "Demonstration data · No real orders will be submitted"
      : environment.connectionState === "live" && environment.marketDataTrustworthy
        ? "Connected to TSE"
        : "Terminal connection unavailable";

  return (
    <div className={`rounded-md border px-4 py-3 ${tone}`} role="status">
      <p className="text-[13px] font-medium text-foreground/90">{headline}</p>
      {!compact ? (
        <>
          <p className="mt-1 text-[12px] text-muted-foreground">{environment.detail}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <span>Mode · {environment.mode}</span>
            {environment.endpointHost ? <span>Host · {environment.endpointHost}</span> : null}
            <span>Adapter · {environment.adapterName}</span>
          </div>
        </>
      ) : null}
    </div>
  );
}
