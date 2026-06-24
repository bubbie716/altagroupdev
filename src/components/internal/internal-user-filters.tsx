"use client";

import { useNavigate } from "@tanstack/react-router";
import type { AccountStatus, UserTag } from "@/lib/auth/types";
import { ALL_ACCOUNT_STATUSES, ALL_USER_TAGS } from "@/lib/internal/user-management.types";
import { formatAccountStatus, formatUserTag } from "@/lib/auth/tags";
import type { InternalUsersSearch } from "@/routes/internal/users/index";

const fieldClass =
  "mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40";

export function InternalUserFilters({ search }: { search: InternalUsersSearch }) {
  const navigate = useNavigate({ from: "/internal/users" });

  function update(partial: Partial<InternalUsersSearch>) {
    void navigate({
      search: (prev: InternalUsersSearch) => ({ ...prev, ...partial }),
      replace: true,
    });
  }

  function clearFilters() {
    void navigate({ search: {}, replace: true });
  }

  return (
    <div className="mb-6 grid gap-4 rounded-lg border border-border/60 bg-surface-2/30 p-4 md:grid-cols-2 lg:grid-cols-5">
      <label className="block text-[12px]">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Username
        </span>
        <input
          className={fieldClass}
          value={search.q ?? ""}
          onChange={(e) => update({ q: e.target.value || undefined })}
          placeholder="Discord or Minecraft"
        />
      </label>
      <label className="block text-[12px]">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Discord ID
        </span>
        <input
          className={fieldClass}
          value={search.discordId ?? ""}
          onChange={(e) => update({ discordId: e.target.value || undefined })}
          placeholder="Partial match"
        />
      </label>
      <label className="block text-[12px]">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Tag
        </span>
        <select
          className={fieldClass}
          value={search.tag ?? ""}
          onChange={(e) => update({ tag: (e.target.value || undefined) as UserTag | undefined })}
        >
          <option value="">All tags</option>
          {ALL_USER_TAGS.map((tag) => (
            <option key={tag} value={tag}>
              {formatUserTag(tag)}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-[12px]">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Account status
        </span>
        <select
          className={fieldClass}
          value={search.accountStatus ?? ""}
          onChange={(e) =>
            update({ accountStatus: (e.target.value || undefined) as AccountStatus | undefined })
          }
        >
          <option value="">All statuses</option>
          {ALL_ACCOUNT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {formatAccountStatus(status)}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end">
        <button
          type="button"
          onClick={clearFilters}
          className="w-full rounded-md border border-border px-3 py-2 text-[12px] text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          Clear filters
        </button>
      </div>
    </div>
  );
}
