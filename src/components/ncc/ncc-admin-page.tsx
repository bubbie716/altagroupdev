import { NccLayout } from "@/components/ncc/ncc-layout";
import { NccCard, NccPageContainer } from "@/components/ncc/ncc-ui";

export function NccAdminPage() {
  return (
    <NccLayout>
      <NccPageContainer>
        <div className="border-b border-[#e5e7eb] pb-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#6b7280]">
            Administration
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[#111827]">
            NCC Admin Panel
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[#6b7280]">
            Network administration tools for authorized NCC operators are under development.
          </p>
        </div>

        <NccCard className="mt-10">
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#6b7280]">
            Coming soon
          </div>
          <p className="mt-3 text-[14px] leading-relaxed text-[#4b5563]">
            This console will support institution onboarding, routing configuration, settlement
            policy, and network operations — separate from Alta Group consumer and banking products.
          </p>
        </NccCard>
      </NccPageContainer>
    </NccLayout>
  );
}
