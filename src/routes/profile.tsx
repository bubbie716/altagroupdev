import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PageShell, Section, Card } from "@/components/page-shell";
import { StatusBadge } from "@/components/internal/status-badge";
import { authBeforeLoad } from "@/lib/auth/guards";
import { formatAccountStatus, formatCompanyRole, formatUserTag } from "@/lib/auth/tags";
import { useRequireCurrentUser } from "@/hooks/use-current-user";
import { fetchUserBankSummary } from "@/lib/bank/bank.functions";
import { florin } from "@/lib/bank/api";

export const Route = createFileRoute("/profile")({
  beforeLoad: authBeforeLoad,
  loader: () => fetchUserBankSummary(),
  head: () => ({ meta: [{ title: "Profile — Alta Group" }] }),
  component: ProfilePage,
});

function ProfileRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/50 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="type-meta">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

function ProfilePage() {
  const user = useRequireCurrentUser();
  const bankSummary = Route.useLoaderData();

  return (
    <PageShell
      eyebrow="Alta Account"
      title={user.discordUsername}
      description="Your Alta identity and authorized company memberships."
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Discord Identity">
          <Card className="!p-5">
            <ProfileRow label="Discord ID" value={<span className="font-mono text-[12px]">{user.discordId}</span>} />
            <ProfileRow label="Username" value={user.discordUsername} />
            <ProfileRow
              label="Email"
              value={user.email ?? <span className="text-muted-foreground">Not provided</span>}
            />
            <ProfileRow
              label="Avatar"
              value={
                user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="size-10 rounded-full border border-border" />
                ) : (
                  "—"
                )
              }
            />
          </Card>
        </Section>

        <Section title="Alta Account">
          <Card className="!p-5">
            <ProfileRow
              label="Minecraft"
              value={
                user.minecraftUsername ?? (
                  <span className="text-muted-foreground">Not linked — placeholder for future sync</span>
                )
              }
            />
            <ProfileRow
              label="Account Status"
              value={<StatusBadge status={formatAccountStatus(user.accountStatus)} />}
            />
            <ProfileRow
              label="Developer / API"
              value={<StatusBadge status={formatAccountStatus(user.developerAccessStatus)} />}
            />
            <ProfileRow
              label="Access Tags"
              value={
                user.tags.length === 0 ? (
                  <span className="text-muted-foreground">None assigned</span>
                ) : (
                  <span className="flex flex-wrap justify-end gap-1.5">
                    {user.tags.map((tag) => (
                      <StatusBadge key={tag} status={formatUserTag(tag)} />
                    ))}
                  </span>
                )
              }
            />
            <ProfileRow label="Member Since" value={<span className="font-mono text-[11px]">{user.createdAt.slice(0, 10)}</span>} />
            <ProfileRow label="Last Login" value={<span className="font-mono text-[11px]">{user.lastLoginAt.slice(0, 10)}</span>} />
          </Card>
        </Section>
      </div>

      <Section title="Alta Bank" className="mt-10">
        <Card className="!p-5">
          {bankSummary.activeAccountCount === 0 ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">No Alta Bank accounts connected yet.</p>
              <Link to="/bank/open" className="text-gold hover:underline">
                Open an account →
              </Link>
            </div>
          ) : (
            <>
              <ProfileRow label="Total Balance" value={<span className="tabular font-medium">{florin(bankSummary.totalBalance)}</span>} />
              <ProfileRow label="Active Accounts" value={String(bankSummary.activeAccountCount)} />
              <ProfileRow label="Pending Accounts" value={String(bankSummary.pendingAccountCount)} />
              <ProfileRow label="Pending Deposits" value={String(bankSummary.pendingDepositCount)} />
              <ProfileRow label="Pending Withdrawals" value={String(bankSummary.pendingWithdrawalCount)} />
              <Link to="/bank" className="mt-4 inline-block text-[12px] text-gold hover:underline">
                View bank dashboard →
              </Link>
            </>
          )}
        </Card>
      </Section>

      <Section title="Linked Companies" className="mt-10">
        <Card className="!p-0">
          {user.companyMemberships.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">
              No company memberships. Authorized representatives will appear here once assigned.
            </p>
          ) : (
            <div className="-mx-4 overflow-x-auto sm:mx-0"><table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left type-meta">
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Ticker</th>
                  <th className="px-4 py-3">Your Role</th>
                </tr>
              </thead>
              <tbody>
                {user.companyMemberships.map((m) => (
                  <tr key={m.companyId} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        to="/companies/$companyId"
                        params={{ companyId: m.companyId }}
                        className="font-medium hover:text-gold"
                      >
                        {m.companyName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{m.companyType}</td>
                    <td className="px-4 py-3 font-mono text-[12px]">{m.companyTicker ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-[11px]">{formatCompanyRole(m.role)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </Card>
        <p className="mt-3 text-[12px] text-muted-foreground">
          Companies do not log in directly. Memberships grant authorized representatives access to act on
          behalf of registered entities.{" "}
          <Link to="/companies" className="text-gold hover:underline">
            Manage companies →
          </Link>
        </p>
      </Section>
    </PageShell>
  );
}
