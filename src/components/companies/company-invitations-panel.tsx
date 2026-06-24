import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/page-shell";
import { StatusBadge } from "@/components/internal/status-badge";
import {
  acceptCompanyInvitationRecord,
  declineCompanyInvitationRecord,
} from "@/lib/company/company.functions";
import type { CompanyInvitationSummary } from "@/lib/company/types";
import { formatCompanyRole } from "@/lib/auth/tags";

export function CompanyInvitationsPanel({
  invitations,
}: {
  invitations: CompanyInvitationSummary[];
}) {
  const router = useRouter();
  const acceptInvitation = useServerFn(acceptCompanyInvitationRecord);
  const declineInvitation = useServerFn(declineCompanyInvitationRecord);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (invitations.length === 0) return null;

  async function refresh() {
    await router.invalidate();
  }

  async function handleAccept(invitationId: string) {
    setError(null);
    setBusyId(invitationId);
    try {
      const result = await acceptInvitation({ data: invitationId });
      await refresh();
      await router.navigate({
        to: "/companies/$companyId",
        params: { companyId: result.companyId },
      });
    } catch {
      setError("Unable to accept invitation. It may have expired or already been handled.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDecline(invitationId: string) {
    setError(null);
    setBusyId(invitationId);
    try {
      await declineInvitation({ data: invitationId });
      await refresh();
    } catch {
      setError("Unable to decline invitation.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mb-10 space-y-4">
      <div>
        <p className="type-meta-accent">
          Pending invitations
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          You have been invited to join a company as an authorized representative. Accept to gain
          access to the company workspace.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {invitations.map((invitation) => (
          <Card key={invitation.id} className="flex flex-col !p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="type-meta">
                  {invitation.companyType}
                </div>
                <h3 className="mt-2 text-lg font-semibold tracking-tight">{invitation.companyName}</h3>
                <p className="mt-2 text-[13px] text-muted-foreground">
                  Invited as{" "}
                  <span className="font-medium text-foreground">
                    {formatCompanyRole(invitation.role)}
                  </span>{" "}
                  by{" "}
                  <span className="font-mono text-[12px]">{invitation.invitedByUsername}</span>
                </p>
              </div>
              <StatusBadge status={invitation.status} />
            </div>

            <div className="mt-4 font-mono text-[11px] text-muted-foreground">
              Sent {invitation.createdAt.slice(0, 10)}
              {invitation.expiresAt && (
                <> · Expires {invitation.expiresAt.slice(0, 10)}</>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busyId === invitation.id}
                onClick={() => handleAccept(invitation.id)}
                className="rounded-md bg-foreground px-4 py-2 text-[13px] font-medium text-background disabled:opacity-60"
              >
                Accept invitation
              </button>
              <button
                type="button"
                disabled={busyId === invitation.id}
                onClick={() => handleDecline(invitation.id)}
                className="rounded-md border border-border px-4 py-2 text-[13px] font-medium disabled:opacity-60"
              >
                Decline
              </button>
            </div>
          </Card>
        ))}
      </div>

      {error && <p className="text-[13px] text-destructive">{error}</p>}

      <Card className="border-gold/30 bg-gold/5 !p-4">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Discord notification delivery is planned for the future bot integration. Invitations are
          delivered here in your Alta account for now.
        </p>
      </Card>
    </div>
  );
}
