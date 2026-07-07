import { NccLayout } from "@/components/ncc/ncc-layout";
import {
  NccBadge,
  NccCard,
  NccPageContainer,
  NccSectionHeader,
  NccStatGrid,
} from "@/components/ncc/ncc-ui";
import { NCC_NETWORK_STATS } from "@/lib/ncc/ncc-tokens";

export function NccNetworkPage() {
  return (
    <NccLayout>
      <NccPageContainer wide>
        <div className="border-b border-[#e5e7eb] pb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">Network</h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[#6b7280]">
            Operational status and performance metrics for the NCC clearing network.
          </p>
        </div>

        <section className="mt-10 space-y-6">
          <NccCard className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6b7280]">
                Network status
              </div>
              <div className="mt-2 flex items-center gap-3">
                <NccBadge status="operational" label="Operational" />
                <span className="text-[14px] text-[#374151]">All core systems nominal</span>
              </div>
            </div>
            <a
              href="https://status.altagroup.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] font-medium text-[#0c4d32] hover:underline"
            >
              status.altagroup.dev →
            </a>
          </NccCard>

          <NccSectionHeader title="Network metrics" />
          <NccStatGrid stats={NCC_NETWORK_STATS} />
        </section>

        <section className="mt-10">
          <NccSectionHeader title="System components" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: "Settlement Engine", status: "operational" as const },
              { name: "Routing Gateway", status: "operational" as const },
              { name: "Message Validation", status: "operational" as const },
              { name: "Institution Directory", status: "operational" as const },
              { name: "Reserve Ledger", status: "operational" as const },
              { name: "Audit & Reporting", status: "operational" as const },
            ].map((sys) => (
              <NccCard key={sys.name} className="flex items-center justify-between gap-3">
                <span className="text-[14px] font-medium text-[#111827]">{sys.name}</span>
                <NccBadge status={sys.status} />
              </NccCard>
            ))}
          </div>
        </section>
      </NccPageContainer>
    </NccLayout>
  );
}
