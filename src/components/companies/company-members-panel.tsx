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
  addCompanyMemberByDiscord,
  removeCompanyMember,
  updateCompanyMemberRole,
} from "@/lib/company/company.functions";
import type { CompanyDetail } from "@/lib/company/types";
import { MEMBER_ROLE_OPTIONS, OWNER_ROLE_OPTION } from "@/lib/company/types";
import type { CompanyRole } from "@/lib/auth/types";
import { formatCompanyRole } from "@/lib/auth/tags";

export function CompanyMembersPanel({ company }: { company: CompanyDetail }) {
  const router = useRouter();
  const updateRole = useServerFn(updateCompanyMemberRole);
  const removeMember = useServerFn(removeCompanyMember);
  const addMember = useServerFn(addCompanyMemberByDiscord);

  const [inviteIdentifier, setInviteIdentifier] = useState("");
  const [inviteRole, setInviteRole] = useState<CompanyRole>("viewer");
  const [inviteNotice, setInviteNotice] = useState<string | null>(null);
  const [inviteSimulated, setInviteSimulated] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const roleOptions =
    company.currentUserRole === "owner"
      ? [OWNER_ROLE_OPTION, ...MEMBER_ROLE_OPTIONS]
      : MEMBER_ROLE_OPTIONS;

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
      setActionError("Unable to update role. Executives cannot modify owners.");
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
      setActionError("Unable to remove member. At least one owner must remain.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleAddExisting() {
    setActionError(null);
    setInviteNotice(null);
    setInviteSimulated(false);
    if (!inviteIdentifier.trim()) return;

    try {
      const result = await addMember({ data: {
        companyId: company.id,
        discordIdentifier: inviteIdentifier.trim(),
        role: inviteRole,
      }});
      setInviteNotice(`Added ${result.username} as ${formatCompanyRole(inviteRole)}.`);
      setInviteIdentifier("");
      await refresh();
    } catch {
      setInviteSimulated(true);
      setInviteNotice(
        "No Alta account found for that Discord user. Invitation queued for preview — Discord invitation delivery is planned for the future bot integration.",
      );
    }
  }

  function handleSendInvitation() {
    setInviteSimulated(true);
    setInviteNotice(
      "Invitation prepared (preview). Discord invitation delivery is planned for the future bot integration — DMs, admin channel logs, acceptance links, and role confirmation will be handled by the Alta bot.",
    );
  }

  return (
    <div className="space-y-8">
      <Card className="!p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Minecraft</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Status</th>
              {company.canManageMembers && <th className="px-4 py-3">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {company.members.map((m) => (
              <tr key={m.membershipId} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-3 font-mono text-[12px]">{m.discordUsername}</td>
                <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                  {m.minecraftUsername ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {company.canManageMembers ? (
                    <Select
                      value={m.role}
                      disabled={busyId === m.membershipId}
                      onValueChange={(value) => handleRoleChange(m.membershipId, value as CompanyRole)}
                    >
                      <SelectTrigger className="h-8 w-[180px] text-[12px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((o) => (
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
                    <button
                      type="button"
                      disabled={busyId === m.membershipId}
                      onClick={() => handleRemove(m.membershipId)}
                      className="font-mono text-[10px] uppercase tracking-[0.14em] text-destructive hover:underline disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {actionError && <p className="text-[13px] text-destructive">{actionError}</p>}

      {company.canManageMembers && (
        <Card className="space-y-5 !p-6">
          <div>
            <h3 className="font-medium tracking-tight">Invite authorized representative</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              Add an existing Alta user by Discord username or ID. Users without an Alta account
              receive a preview invitation state until the Discord bot integration ships.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Discord username or ID
              </span>
              <Input
                className="mt-2 font-mono"
                value={inviteIdentifier}
                onChange={(e) => setInviteIdentifier(e.target.value)}
                placeholder="username or 18-digit ID"
              />
            </label>
            <label className="block">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Role
              </span>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as CompanyRole)}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEMBER_ROLE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleAddExisting}
              className="rounded-md bg-foreground px-4 py-2 text-[13px] font-medium text-background"
            >
              Add existing user
            </button>
            <button
              type="button"
              onClick={handleSendInvitation}
              className="rounded-md border border-border px-4 py-2 text-[13px] font-medium"
            >
              Send invitation
            </button>
          </div>

          {inviteNotice && (
            <Card
              className={
                inviteSimulated
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
