import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  cancelScheduledTradeFn,
  fetchScheduledTradeDetailFn,
  pauseScheduledTradeFn,
  resumeScheduledTradeFn,
} from "@/lib/terminal/scheduled-trade.functions";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { RoutePendingFallback } from "@/components/ui/route-pending-fallback";
import { scheduledTradeFrequencyLabel } from "@/lib/terminal/scheduled-trade-copy";
import { refreshMutationRouteData } from "@/lib/router/post-mutation-refresh";
import { readDevSiteFromSearch } from "@/lib/site/preserve-dev-site-search";

export const Route = createFileRoute("/terminal/orders/scheduled/$instructionId")({
  validateSearch: (search: Record<string, unknown>) => ({
    site: readDevSiteFromSearch(search) ?? "terminal",
  }),
  loader: ({ params }) => fetchScheduledTradeDetailFn({ data: params.instructionId }),
  pendingComponent: () => <RoutePendingFallback label="Loading scheduled trade" />,
  head: () => ({ meta: [{ title: "Scheduled trade — Alta Terminal" }] }),
  component: ScheduledTradeDetailPage,
});

function ScheduledTradeDetailPage() {
  const detail = Route.useLoaderData();
  const router = useRouter();
  const pauseFn = useServerFn(pauseScheduledTradeFn);
  const resumeFn = useServerFn(resumeScheduledTradeFn);
  const cancelFn = useServerFn(cancelScheduledTradeFn);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link
          to="/terminal/orders"
          search={{ tab: "scheduled", status: "all", side: "all", site: "terminal" }}
          className="text-[13px] text-[var(--terminal-muted)]"
        >
          ← Scheduled trades
        </Link>
        <h1 className="mt-2 text-[24px] font-medium tracking-tight">
          {detail.side.toUpperCase()}{" "}
          {detail.instrumentKind === "CRYPTO" && detail.sizingMode === "FLORIN_AMOUNT"
            ? `ƒ${detail.florinAmount}`
            : detail.quantity}{" "}
          {detail.symbol}
          {detail.instrumentKind === "CRYPTO" ? " · Crypto" : ""}
        </h1>
        <p className="mt-1 text-[13px] capitalize text-[var(--terminal-muted)]">
          {detail.status} · {detail.scheduleType.replace("_", " ")} · {detail.portfolioName}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-lg border border-[var(--terminal-border)] p-4 text-[13px]">
        <Field label="Start" value={formatActivityDateTime(detail.startAt)} />
        {detail.scheduleType === "recurring" ? (
          <Field label="Frequency" value={scheduledTradeFrequencyLabel(detail.frequency)} />
        ) : null}
        <Field label="Next run" value={detail.nextRunAt ? formatActivityDateTime(detail.nextRunAt) : "—"} />
        <Field label="End" value={detail.endAt ? formatActivityDateTime(detail.endAt) : "—"} />
        <Field label="Timezone" value={detail.timeZonePolicy} />
        <Field label="Consecutive failures" value={String(detail.consecutiveFailures)} />
        <Field label="Last attempt" value={detail.lastAttemptAt ? formatActivityDateTime(detail.lastAttemptAt) : "—"} />
      </dl>

      {detail.lastFailureSummary ? (
        <p className="text-[13px] text-[var(--terminal-red)]">{detail.lastFailureSummary}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {detail.status === "active" ? (
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-[13px] min-h-11"
            onClick={() => void pauseFn({ data: detail.id }).then(() => refreshMutationRouteData(router, "terminal"))}
          >
            Pause
          </button>
        ) : null}
        {detail.status === "paused" ? (
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-[13px] min-h-11"
            onClick={() => void resumeFn({ data: detail.id }).then(() => refreshMutationRouteData(router, "terminal"))}
          >
            Resume
          </button>
        ) : null}
        {["active", "paused"].includes(detail.status) ? (
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-[13px] min-h-11"
            onClick={() => void cancelFn({ data: detail.id }).then(() => refreshMutationRouteData(router, "terminal"))}
          >
            Cancel schedule
          </button>
        ) : null}
      </div>

      {detail.recentOccurrences.length > 0 ? (
        <section>
          <h2 className="text-[15px] font-medium">Recent attempts</h2>
          <ul className="mt-3 divide-y divide-[var(--terminal-border)] rounded-lg border border-[var(--terminal-border)]">
            {detail.recentOccurrences.map((occ) => (
              <li key={occ.id} className="px-4 py-3 text-[13px]">
                <div className="capitalize">{occ.status}</div>
                <div className="text-[var(--terminal-muted)]">
                  {formatActivityDateTime(occ.scheduledRunAt)}
                  {occ.customerFailureSummary ? ` · ${occ.customerFailureSummary}` : ""}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-[var(--terminal-muted)]">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
