import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PageShell } from "@/components/page-shell";
import { StatusBadge } from "@/components/internal/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Florin } from "@/components/ui/florin";
import { authBeforeLoad } from "@/lib/auth/guards";
import { formatAccountStatus, formatCompanyRole, formatUserTag } from "@/lib/auth/tags";
import { useRequireCurrentUser } from "@/hooks/use-current-user";
import { fetchUserBankSummary } from "@/lib/bank/bank.functions";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/components/auth/sign-out-button";

export const Route = createFileRoute("/profile")({
  beforeLoad: authBeforeLoad,
  loader: () => fetchUserBankSummary(),
  head: () => ({ meta: [{ title: "Profile — Alta Group" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const user = useRequireCurrentUser();
  const bankSummary = Route.useLoaderData();

  const initials = (user.discordUsername || "A")
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const isPrivate = user.tags.includes("private_client");
  const isOperator = user.tags.includes("operator") || user.tags.includes("admin");

  const memberSinceLabel = user.createdAt.slice(0, 10);
  const lastLoginLabel = user.lastLoginAt.slice(0, 16).replace("T", " ") + " ET";

  return (
    <PageShell
      eyebrow="Alta Account · Identity"
      title="Profile"
      description="Your Alta identity, relationships, security posture and platform permissions."
    >
      {/* IDENTITY CARD */}
      <section className="relative overflow-hidden rounded-xl border border-border bg-surface-1">
        <div className="h-px w-full bg-linear-to-r from-transparent via-gold/50 to-transparent" />
        <div className="grid gap-px bg-border/60 sm:grid-cols-[1.4fr_1fr]">
          <div className="bg-surface-1 px-6 py-8 sm:px-10 sm:py-10">
            <div className="flex items-start gap-5">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="size-16 shrink-0 rounded-full border border-border object-cover"
                />
              ) : (
                <div className="grid size-16 shrink-0 place-items-center rounded-full border border-gold/40 bg-gold/[0.06] font-serif text-xl tracking-wide">
                  {initials || "A"}
                </div>
              )}
              <div className="min-w-0">
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
                  Alta Identity
                </div>
                <h2 className="mt-1 truncate font-serif text-2xl leading-tight tracking-tight sm:text-3xl">
                  {user.discordUsername}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={formatAccountStatus(user.accountStatus)} />
                  {isPrivate ? <StatusBadge status="Private Client" /> : null}
                  {isOperator ? <StatusBadge status="Operator" tone="gold" /> : null}
                </div>
              </div>
            </div>

            <dl className="mt-8 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
              <IdRow label="Member ID" value={user.id.slice(0, 10)} mono />
              <IdRow label="Member since" value={memberSinceLabel} mono />
              <IdRow
                label="Email"
                value={user.email ?? <span className="text-muted-foreground">Not on file</span>}
              />
              <IdRow
                label="Discord"
                value={<span className="font-mono text-[12px]">{user.discordId}</span>}
              />
            </dl>
          </div>

          <div className="flex flex-col justify-between bg-surface-1 px-6 py-8 sm:px-8 sm:py-10">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
                Relationship snapshot
              </div>
              <div className="mt-5 space-y-4">
                <SnapshotRow label="Standing" value={isPrivate ? "Founding Client" : "Standard"} />
                <SnapshotRow
                  label="Total balance"
                  value={<Florin value={bankSummary.totalBalance} />}
                />
                <SnapshotRow
                  label="Active accounts"
                  value={String(bankSummary.activeAccountCount)}
                />
                <SnapshotRow
                  label="Linked companies"
                  value={String(user.companyMemberships.length)}
                />
              </div>
            </div>
            <div className="mt-8 border-t border-border/60 pt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Last access · {lastLoginLabel}
            </div>
          </div>
        </div>
      </section>

      {/* RELATIONSHIP INFORMATION */}
      <ProfileSection index="01" title="Relationship information" kicker="Banking & companies" className="mt-16 sm:mt-20">
        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          <MetricCell label="Total balance" value={<Florin value={bankSummary.totalBalance} />} />
          <MetricCell label="Active accounts" value={String(bankSummary.activeAccountCount)} />
          <MetricCell label="Pending accounts" value={String(bankSummary.pendingAccountCount)} />
          <MetricCell
            label="Pending activity"
            value={String(bankSummary.pendingDepositCount + bankSummary.pendingWithdrawalCount)}
            note={`${bankSummary.pendingDepositCount} dep · ${bankSummary.pendingWithdrawalCount} wd`}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Link
            to="/bank"
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground hover:text-gold"
          >
            Open bank dashboard →
          </Link>
        </div>
      </ProfileSection>

      <ProfileSection
        index="02"
        title="Linked companies"
        kicker="Authorized representations"
        className="mt-16 sm:mt-20"
      >
        {user.companyMemberships.length === 0 ? (
          <EmptyState
            tag="No memberships"
            title="No linked companies"
            description="Authorized representations will appear here once you are assigned to a registered entity."
            action={
              <Link
                to="/companies"
                className="font-mono text-[10px] uppercase tracking-[0.22em] text-foreground hover:text-gold"
              >
                Browse companies →
              </Link>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface-1">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left type-meta">
                    <th className="px-5 py-3">Company</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Ticker</th>
                    <th className="px-5 py-3">Your role</th>
                  </tr>
                </thead>
                <tbody>
                  {user.companyMemberships.map((m) => (
                    <tr key={m.companyId} className="border-b border-border/50 last:border-0">
                      <td className="px-5 py-3">
                        <Link
                          to="/companies/$companyId"
                          params={{ companyId: m.companyId }}
                          className="font-medium hover:text-gold"
                        >
                          {m.companyName}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{m.companyType}</td>
                      <td className="px-5 py-3 font-mono text-[12px]">{m.companyTicker ?? "—"}</td>
                      <td className="px-5 py-3 font-mono text-[11px]">{formatCompanyRole(m.role)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </ProfileSection>

      {/* ACCOUNT SECURITY */}
      <ProfileSection index="03" title="Account security" kicker="Authentication posture" className="mt-16 sm:mt-20">
        <div className="grid gap-4 sm:grid-cols-2">
          <SecurityCard
            label="Sign-in method"
            value="Discord OAuth"
            description="Single sign-on through your Discord account. Alta does not store a password."
            badge={<StatusBadge status="Active" />}
          />
          <SecurityCard
            label="Two-factor authentication"
            value="Managed by Discord"
            description="Enable 2FA on your Discord account to protect access to Alta."
            badge={<StatusBadge status="Recommended" tone="warning" />}
          />
          <SecurityCard
            label="Account status"
            value={formatAccountStatus(user.accountStatus)}
            description="Restrictions, freezes, or pending reviews appear here."
            badge={<StatusBadge status={formatAccountStatus(user.accountStatus)} />}
          />
          <SecurityCard
            label="Recovery email"
            value={user.email ?? "Not on file"}
            description="Used for service notices. Update via your Discord account."
            badge={
              user.email ? (
                <StatusBadge status="On file" tone="success" />
              ) : (
                <StatusBadge status="Missing" />
              )
            }
          />
        </div>
      </ProfileSection>

      {/* PLATFORM PERMISSIONS */}
      <ProfileSection
        index="04"
        title="Platform permissions"
        kicker="What this identity may access"
        className="mt-16 sm:mt-20"
      >
        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          <PermissionCell
            label="Access tags"
            primary={
              user.tags.length === 0 ? (
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  None assigned
                </span>
              ) : (
                <span className="flex flex-wrap gap-1.5">
                  {user.tags.map((tag) => (
                    <StatusBadge key={tag} status={formatUserTag(tag)} />
                  ))}
                </span>
              )
            }
          />
          <PermissionCell
            label="Developer / API"
            primary={<StatusBadge status={formatAccountStatus(user.developerAccessStatus)} />}
            note={user.developerAccess ? "API keys may be issued." : "Apply through the API portal."}
          />
          <PermissionCell
            label="Internal operations"
            primary={
              user.internalAccess ? (
                <StatusBadge status="Granted" tone="success" />
              ) : (
                <StatusBadge status="Not granted" />
              )
            }
            note={user.internalAccess ? "Internal portal visible in your nav." : undefined}
          />
        </div>
      </ProfileSection>

      {/* SESSIONS */}
      <ProfileSection index="05" title="Sessions" kicker="Active devices" className="mt-16 sm:mt-20">
        <div className="overflow-hidden rounded-lg border border-border bg-surface-1">
          <div className="grid grid-cols-[1fr_auto] items-center gap-4 px-6 py-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-serif text-base">Current session</span>
                <StatusBadge status="Active" />
              </div>
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                Last sign-in · {lastLoginLabel}
              </div>
            </div>
            <SignOutButton className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground" />
          </div>
        </div>
      </ProfileSection>

      {/* PREFERENCES */}
      <ProfileSection index="06" title="Preferences" kicker="Display & notices" className="mt-16 sm:mt-20">
        <div className="grid gap-4 sm:grid-cols-2">
          <PreferenceRow
            label="Linked Minecraft"
            value={
              user.minecraftUsername ?? (
                <span className="text-muted-foreground">Not linked</span>
              )
            }
            hint="Reserved for future game-server identity sync."
          />
          <PreferenceRow
            label="Theme"
            value="Follows system"
            hint="Toggle light or dark from the top navigation."
          />
        </div>
      </ProfileSection>
    </PageShell>
  );
}

/* ---------- Layout primitives ---------- */

function ProfileSection({
  index,
  title,
  kicker,
  className,
  children,
}: {
  index: string;
  title: string;
  kicker?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={className}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border/40 pb-4 sm:mb-8">
        <div className="flex items-baseline gap-4 sm:gap-6">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-gold">{index}</span>
          <div className="min-w-0">
            {kicker && (
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {kicker}
              </div>
            )}
            <h2 className="mt-1 font-serif text-2xl tracking-tight sm:text-3xl">{title}</h2>
          </div>
        </div>
      </div>
      {children}
    </section>
  );
}

function IdRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/40 py-2 last:border-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      <span className={cn("text-[13px] text-foreground", mono && "font-mono")}>{value}</span>
    </div>
  );
}

function SnapshotRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/50 pb-3 last:border-0 last:pb-0">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      <span className="font-serif text-[15px] tracking-tight text-foreground">{value}</span>
    </div>
  );
}

function MetricCell({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: string;
}) {
  return (
    <div className="flex h-full flex-col justify-between bg-surface-1 px-5 py-5 sm:px-6 sm:py-6">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-4 font-serif text-xl leading-tight tracking-tight sm:text-2xl">
        {value}
      </div>
      {note ? (
        <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {note}
        </div>
      ) : null}
    </div>
  );
}

function SecurityCard({
  label,
  value,
  description,
  badge,
}: {
  label: string;
  value: string;
  description: string;
  badge: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-border bg-surface-1 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">{label}</div>
          <div className="mt-2 font-serif text-lg leading-tight tracking-tight">{value}</div>
        </div>
        <div className="shrink-0">{badge}</div>
      </div>
      <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function PermissionCell({
  label,
  primary,
  note,
}: {
  label: string;
  primary: ReactNode;
  note?: string;
}) {
  return (
    <div className="flex h-full flex-col gap-3 bg-surface-1 px-5 py-5 sm:px-6 sm:py-6">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div>{primary}</div>
      {note ? <div className="text-[12px] text-muted-foreground">{note}</div> : null}
    </div>
  );
}

function PreferenceRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-1 px-6 py-5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">{label}</span>
        <span className="font-serif text-[15px]">{value}</span>
      </div>
      {hint ? <p className="mt-2 text-[12px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
