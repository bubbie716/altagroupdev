import { createFileRoute } from "@tanstack/react-router";
import { PortalPageHeader } from "@/components/ncc/portal/portal-shell";
import { fetchDeveloperApiLogs } from "@/lib/ncc/ncc-developer.functions";

export const Route = createFileRoute("/portal/developers/api-logs")({
  loader: () => fetchDeveloperApiLogs({ data: { limit: 50 } }),
  head: () => ({
    meta: [{ title: "API Logs — NCC Institution Portal" }],
  }),
  component: ApiLogsRoute,
});

function ApiLogsRoute() {
  const { logs } = Route.useLoaderData();
  return (
    <div>
      <PortalPageHeader
        eyebrow="Developers"
        title="API Logs"
        description="Sanitized request history. Authorization headers and secrets are never stored."
      />
      <section className="rounded-sm border border-[#e5e7eb] bg-white shadow-sm">
        <table className="w-full text-left text-[12px]">
          <thead className="border-b border-[#e5e7eb] bg-[#f9fafb] text-[10px] uppercase tracking-[0.12em] text-[#6b7280]">
            <tr>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Method</th>
              <th className="px-3 py-2">Route</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Error</th>
              <th className="px-3 py-2">Latency</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((row: (typeof logs)[number]) => (
              <tr key={row.id} className="border-b border-[#f3f4f6]">
                <td className="px-3 py-2">{row.createdAt}</td>
                <td className="px-3 py-2">{row.method}</td>
                <td className="px-3 py-2 font-mono text-[11px]">{row.route}</td>
                <td className="px-3 py-2">{row.responseStatus}</td>
                <td className="px-3 py-2">{row.errorCode ?? "—"}</td>
                <td className="px-3 py-2">{row.latencyMs} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
