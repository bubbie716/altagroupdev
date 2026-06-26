import { useState } from "react";
import type { CompanyEmployeeCardMemberOption } from "@/lib/bank/alta-card-types";
import { formatCompanyRole } from "@/lib/auth/tags";
import { createEmployeeCardRecord } from "@/lib/bank/alta-card.functions";

export function AltaCardEmployeeCardCreateForm({
  companyId,
  members,
  onCreated,
  compact = false,
}: {
  companyId: string;
  members: CompanyEmployeeCardMemberOption[];
  onCreated: () => Promise<void>;
  compact?: boolean;
}) {
  const eligibleMembers = members.filter((member) => !member.hasActiveEmployeeCard);
  const [authorizedUserId, setAuthorizedUserId] = useState(eligibleMembers[0]?.userId ?? "");
  const [spendLimit, setSpendLimit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const limit = Number(spendLimit);
      if (!authorizedUserId) {
        setError("Select a company member");
        return;
      }
      if (!Number.isFinite(limit) || limit <= 0) {
        setError("Enter a valid spend limit");
        return;
      }
      await createEmployeeCardRecord({
        data: { companyId, authorizedUserId, employeeSpendLimit: limit },
      });
      setAuthorizedUserId(eligibleMembers.find((m) => m.userId !== authorizedUserId)?.userId ?? "");
      setSpendLimit("");
      await onCreated();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create employee card";
      setError(message.replace(/^BAD_REQUEST:/, ""));
    } finally {
      setLoading(false);
    }
  }

  if (eligibleMembers.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground">
        All company members already have an active employee card, or there are no members to authorize.
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className={compact ? "space-y-2" : "mt-4 grid gap-4 sm:grid-cols-2"}
    >
      <label className={compact ? "block space-y-1" : "space-y-2 sm:col-span-2"}>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Authorized member
        </span>
        <select
          value={authorizedUserId}
          onChange={(e) => setAuthorizedUserId(e.target.value)}
          className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 text-[14px]"
        >
          <option value="">Select member…</option>
          {eligibleMembers.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.username} · {formatCompanyRole(member.role)}
            </option>
          ))}
        </select>
      </label>
      <label className={compact ? "block space-y-1" : "space-y-2"}>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          Employee spend limit
        </span>
        <input
          type="number"
          min={0}
          step="0.01"
          value={spendLimit}
          onChange={(e) => setSpendLimit(e.target.value)}
          className="w-full rounded-md border border-border bg-surface-1 px-3 py-2 font-mono text-[14px]"
        />
      </label>
      {error ? (
        <p className={compact ? "text-[13px] text-destructive" : "sm:col-span-2 text-[13px] text-destructive"}>
          {error}
        </p>
      ) : null}
      <div className={compact ? undefined : "sm:col-span-2"}>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-foreground px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-background disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create employee card"}
        </button>
      </div>
    </form>
  );
}
