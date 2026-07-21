import { NccLayout } from "@/components/ncc/ncc-layout";
import {
  NccBadge,
  NccCard,
  NccDataTable,
  NccPageContainer,
  NccSectionHeader,
  NccStatGrid,
} from "@/components/ncc/ncc-ui";

const dashboardStats = [
  { label: "Institution Status", value: "Operational", status: "operational" as const },
  { label: "Settlement Queue", value: "3" },
  { label: "Routing Number", value: "021000001" },
  { label: "Reserve Balance", value: "ƒ 48.2M" },
  { label: "Pending Transfers", value: "12", status: "queued" as const },
];

export function NccDashboardPage() {
  return (
    <NccLayout>
      <NccPageContainer wide className="space-y-10">
        <div className="border-b border-[#e5e7eb] pb-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#6b7280]">
            Operations Console
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#111827]">
            Institution Dashboard
          </h1>
          <p className="mt-2 text-[14px] text-[#6b7280]">
            Real-time clearing, settlement, and network operations for authorized representatives.
          </p>
        </div>

        <NccStatGrid stats={dashboardStats} />

        <section>
          <NccSectionHeader title="Settlement Queue" />
          <NccDataTable
            columns={[
              { key: "id", header: "Reference" },
              { key: "from", header: "Originator" },
              { key: "to", header: "Beneficiary" },
              { key: "amount", header: "Amount", className: "tabular-nums" },
              { key: "status", header: "Status" },
            ]}
            rows={[
              {
                id: "STL-20260306-001",
                from: "Alta Bank N.V.",
                to: "Alta Terminal LLC",
                amount: "ƒ 1,250,000",
                status: <NccBadge status="queued" />,
              },
              {
                id: "STL-20260306-002",
                from: "Harbor Trust Company",
                to: "Alta Bank N.V.",
                amount: "ƒ 420,000",
                status: <NccBadge status="pending" />,
              },
              {
                id: "STL-20260305-014",
                from: "Alta Bank N.V.",
                to: "Newport Payment Services",
                amount: "ƒ 89,500",
                status: <NccBadge status="completed" />,
              },
            ]}
          />
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <NccSectionHeader title="Network Messages" />
            <NccCard className="space-y-3 p-0">
              {[
                { time: "14:32 UTC", msg: "Settlement batch SB-4401 completed successfully." },
                { time: "13:58 UTC", msg: "Routing table sync completed — 847 entries." },
                { time: "12:15 UTC", msg: "Institution Harbor Trust Company — status restricted." },
              ].map((item) => (
                <div
                  key={item.time}
                  className="border-b border-[#f3f4f6] px-4 py-3 last:border-0 text-[13px]"
                >
                  <span className="font-mono text-[11px] text-[#9ca3af]">{item.time}</span>
                  <p className="mt-1 text-[#374151]">{item.msg}</p>
                </div>
              ))}
            </NccCard>
          </section>

          <section>
            <NccSectionHeader title="Operational Alerts" />
            <NccCard className="space-y-3 p-0">
              {[
                { level: "warning" as const, text: "Reserve threshold review scheduled for 18:00 UTC." },
                { level: "operational" as const, text: "No critical incidents in the last 72 hours." },
              ].map((alert, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 border-b border-[#f3f4f6] px-4 py-3 last:border-0"
                >
                  <NccBadge status={alert.level} />
                  <p className="text-[13px] text-[#374151]">{alert.text}</p>
                </div>
              ))}
            </NccCard>
          </section>
        </div>
      </NccPageContainer>
    </NccLayout>
  );
}
