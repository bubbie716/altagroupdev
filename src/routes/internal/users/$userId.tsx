import { createFileRoute, Link } from "@tanstack/react-router";
import { Section, Card } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { StatusBadge } from "@/components/internal/status-badge";
import { InternalUserTagPanel } from "@/components/internal/internal-user-tag-panel";
import { InternalUserAccountStatusPanel } from "@/components/internal/internal-user-account-status-panel";
import { formatAccountStatus, formatUserTag } from "@/lib/auth/tags";
import { florin } from "@/lib/bank/api";
import { formatActivityDateTime } from "@/lib/format-datetime";
import { fetchInternalUserDetail } from "@/lib/internal/user-management.functions";

export const Route = createFileRoute("/internal/users/$userId")({
  loader: ({ params }) => fetchInternalUserDetail({ data: params.userId }),
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.discordUsername ?? "User"} — Alta Internal` }],
  }),
  component: InternalUserDetailPage,
});

function InternalUserDetailPage() {
  const user = Route.useLoaderData();

  return (
    <InternalPageShell
      title={user.discordUsername}
      description={`Discord ID ${user.discordId} · User record ${user.id}`}
    >
      <Link
        to="/internal/users"
        className="mb-6 inline-block font-mono text-[12px] text-gold hover:underline"
      >
        ← Back to users
      </Link>

      <div className="mb-8 flex flex-wrap items-start gap-6">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt=""
            className="size-16 rounded-full border border-border bg-surface-2"
          />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-full border border-border bg-surface-2 font-mono text-lg text-muted-foreground">
            {user.discordUsername.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={formatAccountStatus(user.accountStatus)} />
            {user.tags.map((tag: any) => (
              <span
                key={tag}
                className="inline-flex rounded bg-surface-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground"
              >
                {formatUserTag(tag)}
              </span>
            ))}
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Email
              </dt>
              <dd className="mt-1">{user.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Minecraft
              </dt>
              <dd className="mt-1 font-mono text-[12px]">{user.minecraftUsername ?? "—"}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Last login
              </dt>
              <dd className="mt-1 font-mono text-[12px]">{user.lastLoginAt.slice(0, 19).replace("T", " ")}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Created
              </dt>
              <dd className="mt-1 font-mono text-[12px]">{user.createdAt.slice(0, 10)}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Companies
              </dt>
              <dd className="mt-1 type-finance">{user.companyCount}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Bank accounts
              </dt>
              <dd className="mt-1 type-finance">{user.bankAccountCount}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Access tags">
          <Card className="!p-6">
            <InternalUserTagPanel user={user} />
          </Card>
        </Section>

        <Section title="Account status">
          <Card className="!p-6">
            <InternalUserAccountStatusPanel user={user} />
          </Card>
        </Section>
      </div>

      <Section title="Linked companies" className="mt-10">
        {user.companyMemberships.length === 0 ? (
          <Card className="!p-6 text-[13px] text-muted-foreground">No company memberships.</Card>
        ) : (
          <Card className="!p-0">
            <div className="w-full overflow-x-auto"><table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left type-meta">
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Role</th>
                </tr>
              </thead>
              <tbody>
                {user.companyMemberships.map((m: any) => (
                  <tr key={m.companyId} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3">
                      <Link
                        to="/internal/companies/$companyId"
                        params={{ companyId: m.companyId }}
                        className="hover:text-gold"
                      >
                        {m.companyName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{m.roleLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </Card>
        )}
      </Section>

      <Section title="Bank accounts" className="mt-10">
        {user.bankAccounts.length === 0 ? (
          <Card className="!p-6 text-[13px] text-muted-foreground">No bank accounts.</Card>
        ) : (
          <Card className="!p-0">
            <div className="w-full overflow-x-auto"><table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left type-meta">
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {user.bankAccounts.map((a: any) => (
                  <tr key={a.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3">
                      <div>{a.accountName}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {a.accountNumber}
                        {a.companyName ? ` · ${a.companyName}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[12px]">{a.accountTypeLabel}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={a.statusLabel} />
                    </td>
                    <td className="tabular px-4 py-3 text-right">{florin(a.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </Card>
        )}
      </Section>

      {user.recentTransactions.length > 0 && (
        <Section title="Recent bank activity" className="mt-10">
          <Card className="!p-0">
            <div className="w-full overflow-x-auto"><table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left type-meta">
                  <th className="px-4 py-3">Date & time</th>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {user.recentTransactions.map((tx: any) => (
                  <tr key={tx.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                      {formatActivityDateTime(tx.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[12px]">{tx.accountName}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">{tx.description}</div>
                    </td>
                    <td className="px-4 py-3">{tx.type}</td>
                    <td className="tabular px-4 py-3 text-right">{florin(tx.amount)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={tx.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </Card>
        </Section>
      )}
    </InternalPageShell>
  );
}
