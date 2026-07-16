import { Link } from "@tanstack/react-router";
import { NccLayout } from "@/components/ncc/ncc-layout";
import { NccCard, NccPageContainer } from "@/components/ncc/ncc-ui";
import { useCurrentUser } from "@/hooks/use-current-user";
import { canBypassMaintenanceMode } from "@/lib/auth/permissions";
import { formatActivityDateTime } from "@/lib/format-datetime";
import type { NccMaintenanceModeState } from "@/lib/ncc/ncc-maintenance-types";

export function NccMaintenancePage({ maintenance }: { maintenance: NccMaintenanceModeState }) {
  const user = useCurrentUser();
  const isBypassUser = user ? canBypassMaintenanceMode(user) : false;

  return (
    <NccLayout footer="copyright">
      <NccPageContainer className="py-16 sm:py-24">
        <div className="mx-auto max-w-lg">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#0c4d32]">
            Newport Clearing Corporation
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
            Network Maintenance
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[#6b7280]">{maintenance.message}</p>

          <NccCard className="mt-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 border-b border-[#e5e7eb] pb-4">
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#6b7280]">
                  Status
                </span>
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#0c4d32]">
                  Maintenance Active
                </span>
              </div>

              {maintenance.startedAt ? (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#6b7280]">
                    Started
                  </span>
                  <span className="text-[12px] text-[#111827]">
                    {formatActivityDateTime(maintenance.startedAt)}
                  </span>
                </div>
              ) : null}

              <p className="pt-2 text-[13px] leading-relaxed text-[#6b7280]">
                Please check back shortly.
              </p>
            </div>
          </NccCard>

          {isBypassUser ? (
            <div className="mt-8 rounded-sm border border-[#0c4d32]/20 bg-[#e8f2ed]/60 px-5 py-4">
              <p className="text-[13px] text-[#4b5563]">
                Your operator account bypasses maintenance mode. The NCC site remains available.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to="/portal"
                  className="inline-flex items-center justify-center rounded-sm border border-[#0c4d32]/30 bg-[#e8f2ed] px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#0c4d32]"
                >
                  Continue to console
                </Link>
                <Link
                  to="/admin"
                  className="inline-flex items-center justify-center rounded-sm border border-[#e5e7eb] px-4 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-[#374151]"
                >
                  Admin panel
                </Link>
              </div>
            </div>
          ) : null}

          {user && !isBypassUser ? (
            <p className="mt-6 text-center text-[12px] text-[#6b7280]">
              Signed in as {user.discordUsername}. Access will resume when maintenance ends.
            </p>
          ) : null}
        </div>
      </NccPageContainer>
    </NccLayout>
  );
}
