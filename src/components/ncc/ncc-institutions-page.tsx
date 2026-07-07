import { NccLayout } from "@/components/ncc/ncc-layout";
import {
  NccBadge,
  NccCard,
  NccDataTable,
  NccPageContainer,
  NccSectionHeader,
} from "@/components/ncc/ncc-ui";
import { NCC_INSTITUTIONS } from "@/lib/ncc/ncc-tokens";

export function NccInstitutionsPage() {
  return (
    <NccLayout>
      <NccPageContainer wide>
        <div className="border-b border-[#e5e7eb] pb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">Institutions</h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[#6b7280]">
            Authoritative directory of institutions approved to participate in the NCC clearing and
            settlement network.
          </p>
        </div>

        <section className="mt-10">
          <NccSectionHeader title="Participating Institutions" />
          <NccDataTable
            columns={[
              { key: "name", header: "Institution" },
              { key: "type", header: "Type" },
              { key: "routing", header: "Routing", className: "font-mono" },
              { key: "status", header: "Status" },
            ]}
            rows={NCC_INSTITUTIONS.map((inst) => ({
              name: inst.name,
              type: inst.type,
              routing: inst.routing,
              status: <NccBadge status={inst.status} />,
            }))}
          />
        </section>

        <section className="mt-10">
          <NccSectionHeader title="Future Participants" />
          <div className="grid gap-4 sm:grid-cols-2">
            <NccCard>
              <h3 className="text-[15px] font-semibold text-[#111827]">Application pipeline</h3>
              <p className="mt-2 text-[13px] text-[#6b7280]">
                Additional payment providers and regulated institutions are under review for network
                participation.
              </p>
              <p className="mt-4 text-[13px] font-medium text-[#374151]">2 applications in review</p>
            </NccCard>
            <NccCard>
              <h3 className="text-[15px] font-semibold text-[#111827]">Onboarding requirements</h3>
              <p className="mt-2 text-[13px] text-[#6b7280]">
                Institutions must execute the Participation Agreement and comply with Operating Rules
                prior to activation.
              </p>
            </NccCard>
          </div>
        </section>
      </NccPageContainer>
    </NccLayout>
  );
}
