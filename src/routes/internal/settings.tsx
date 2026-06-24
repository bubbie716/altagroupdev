import { createFileRoute } from "@tanstack/react-router";
import { Section, Card } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { StatusBadge } from "@/components/internal/status-badge";
import { getInternalSettings } from "@/lib/internal/api";

export const Route = createFileRoute("/internal/settings")({
  head: () => ({ meta: [{ title: "Settings — Alta Internal" }] }),
  component: InternalSettingsPage,
});

function InternalSettingsPage() {
  const s = getInternalSettings();

  return (
    <InternalPageShell title="Internal Settings" description="System configuration and feature flags — simulated controls only.">
      <Section title="System Configuration">
        <Card className="grid gap-4 md:grid-cols-2 !p-5">
          <label className="block">
            <span className="type-meta">Maintenance mode</span>
            <select disabled className="mt-2 w-full cursor-not-allowed rounded-md border border-border bg-surface-2/50 px-3 py-2 text-sm text-muted-foreground">
              <option>{s.maintenanceMode ? "Enabled" : "Disabled"}</option>
            </select>
          </label>
          <label className="block">
            <span className="type-meta">Market status</span>
            <select disabled className="mt-2 w-full cursor-not-allowed rounded-md border border-border bg-surface-2/50 px-3 py-2 text-sm text-muted-foreground">
              <option>{s.marketStatus}</option>
            </select>
          </label>
          <label className="block">
            <span className="type-meta">Bank transfers</span>
            <select disabled className="mt-2 w-full cursor-not-allowed rounded-md border border-border bg-surface-2/50 px-3 py-2 text-sm text-muted-foreground">
              <option>{s.bankTransfers}</option>
            </select>
          </label>
          <label className="block">
            <span className="type-meta">IPO applications</span>
            <select disabled className="mt-2 w-full cursor-not-allowed rounded-md border border-border bg-surface-2/50 px-3 py-2 text-sm text-muted-foreground">
              <option>{s.ipoApplications}</option>
            </select>
          </label>
        </Card>
      </Section>

      <Section title="Feature Flags" className="mt-10">
        <Card className="!p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left type-meta">
                <th className="px-4 py-3">Flag</th>
                <th className="px-4 py-3">Key</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {s.featureFlags.map((f) => (
                <tr key={f.key} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-3">{f.label}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{f.key}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={f.enabled ? "Active" : "Suspended"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>
    </InternalPageShell>
  );
}
