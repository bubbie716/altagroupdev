import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/page-shell";
import { StatusBadge } from "@/components/internal/status-badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  removeCompanyMember,
  sendCompanyInvitationRecord,
  updateCompanyMemberRole,
} from "@/lib/company/company.functions";
import type { CompanyDetail } from "@/lib/company/types";
import { MEMBER_ROLE_OPTIONS, OWNER_ROLE_OPTION } from "@/lib/company/types";
import type { CompanyRole } from "@/lib/auth/types";
import { formatCompanyRole } from "@/lib/auth/tags";
import {
  canAssignCompanyRole,
  canManageCompanyMember,
} from "@/lib/auth/permissions";

function assignableRoleOptions(actorRole: CompanyRole) {
  const options =
    actorRole === "owner" ? [OWNER_ROLE_OPTION, ...MEMBER_ROLE_OPTIONS] : MEMBER_ROLE_OPTIONS;
  return options.filter((option) => canAssignCompanyRole(actorRole, option.value));
}

export function CompanyMembersPanel({ company }: { company: CompanyDetail }) {
  const router = useRouter();
  const updateRole = useServerFn(updateCompanyMemberRole);
  const removeMember = useServerFn(removeCompanyMember);
  const sendInvitation = useServerFn(sendCompanyInvitationRecord);

  const [inviteIdentifier, setInviteIdentifier] = useState("");
  const [inviteRole, setInviteRole] = useState<CompanyRole>("viewer");
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [inviteIsInfo, setInviteIsInfo] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const inviteRoleOptions = assignableRoleOptions(company.currentUserRole);

  async function refresh() {
    await router.invalidate();
  }

  async function handleRoleChange(membershipId: string, role: CompanyRole) {
    setActionError(null);
    setBusyId(membershipId);
    try {
      await updateRole({ data: { companyId: company.id, membershipId, role } });
      await refresh();
    } catch {
      setActionError("Unable to update role. You cannot modify members at or above your role.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(membershipId: string) {
    setActionError(null);
    setBusyId(membershipId);
    try {
      await removeMember({ data: { companyId: company.id, membershipId } });
      await refresh();
    } catch {
      setActionError("Unable to remove member. You cannot remove members at or above your role.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSendInvitation(e: React.FormEvent) {
    e.preventDefault();
    setActionError(null);
    setInviteNotice(null);
    setInviteIsInfo(false);
    if (!inviteIdentifier.trim()) return;

    setSending(true);
    try {
      await sendInvitation({
        data: {
          companyId: company.id,
          discordIdentifier: inviteIdentifier.trim(),
          role: inviteRole,
        },
      });
      setInviteIsInfo(true);
      setInviteNotice(
        `Invitation sent to ${inviteIdentifier.trim()}. They can accept it from their Companies page. Discord notification delivery is planned for the future bot integration.`,
      );
      setInviteIdentifier("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("ALREADY_MEMBER")) {
        setInviteNotice("That user is already a member of this company.");
      } else if (message.includes("INVITATION_ALREADY_SENT")) {
        setInviteIsInfo(true);
        setInviteNotice("An invitation is already pending for that user.");
      } else {
        setInviteNotice("Unable to send invitation.");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-8">
      <Card className="!p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left type-meta">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Minecraft</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Status</th>
              {company.canManageMembers && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {company.members.map((m) => {
              const canEditMember = canManageCompanyMember(company.currentUserRole, m.role);
              const memberRoleOptions = assignableRoleOptions(company.currentUserRole);

              return (
              <tr key={m.membershipId} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-3 font-mono text-[12px]">{m.discordUsername}</td>
                <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                  {m.minecraftUsername ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {company.canManageMembers && canEditMember ? (
                    <Select
                      value={m.role}
                      disabled={busyId === m.membershipId}
                      onValueChange={(value) => handleRoleChange(m.membershipId, value as CompanyRole)}
                    >
                      <SelectTrigger className="h-8 w-[180px] text-[12px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {memberRoleOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="font-mono text-[11px]">{formatCompanyRole(m.role)}</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                  {m.joinedAt.slice(0, 10)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status="Authorized" />
                </td>
                {company.canManageMembers && (
                  <td className="px-4 py-3">
                    {canEditMember ? (
                      <button
                        type="button"
                        disabled={busyId === m.membershipId}
                        onClick={() => handleRemove(m.membershipId)}
                        className="font-mono text-[10px] uppercase tracking-[0.14em] text-destructive hover:underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    ) : (
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        —
                      </span>
                    )}
                  </td>
                )}
              </tr>
            );
            })}
          </tbody>
        </table>
      </Card>

      {actionError && <p className="text-[13px] text-destructive">{actionError}</p>}

      {company.canManageMembers && (
        <Card className="space-y-5 !p-6">
          <div>
            <h3 className="font-medium tracking-tight">Invite authorized representative</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              Send an invitation for them to accept on their Companies page. Works whether or not
              they already have an Alta account.
            </p>
          </div>

          <form onSubmit={handleSendInvitation} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="type-meta">
                  Discord username or ID
                </span>
                <Input
                  className="mt-2 font-mono"
                  value={inviteIdentifier}
                  onChange={(e) => setInviteIdentifier(e.target.value)}
                  placeholder="username or 18-digit ID"
                  required
                />
              </label>
              <label className="block">
                <span className="type-meta">
                  Role
                </span>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as CompanyRole)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {inviteRoleOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>

            <button
              type="submit"
              disabled={sending}
              className="rounded-md bg-foreground px-4 py-2 text-[13px] font-medium text-background disabled:opacity-60"
            >
              {sending ? "Sending…" : "Send invitation"}
            </button>
          </form>

          {inviteNotice && (
            <Card
              className={
                inviteIsInfo
                  ? "border-gold/30 bg-gold/5 !p-4 text-[13px] leading-relaxed text-muted-foreground"
                  : "!p-4 text-[13px] text-foreground"
              }
            >
              {inviteNotice}
            </Card>
          )}
        </Card>
      )}
    </div>
  );
}
