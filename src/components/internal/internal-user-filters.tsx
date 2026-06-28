"use client";

import { useNavigate } from "@tanstack/react-router";
import type { AccountStatus, UserTag } from "@/lib/auth/types";
import { ALL_ACCOUNT_STATUSES, ALL_USER_TAGS } from "@/lib/internal/user-management.types";
import { formatAccountStatus, formatUserTag } from "@/lib/auth/tags";
import type { InternalUsersSearch } from "@/routes/internal/users/index";
import {
  OpsFilterBar,
  OpsFilterField,
  OPS_FILTER_FIELD_CLASS,
} from "@/components/internal/console/ops-filter-bar";

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

  const hasFilters = Boolean(search.q || search.discordId || search.tag || search.accountStatus);

  return (
    <OpsFilterBar onClear={hasFilters ? clearFilters : undefined}>
      <OpsFilterField label="Username">
        <input
          className={OPS_FILTER_FIELD_CLASS}
          value={search.q ?? ""}
          onChange={(e) => update({ q: e.target.value || undefined })}
          placeholder="Discord or Minecraft"
        />
      </OpsFilterField>
      <OpsFilterField label="Discord ID">
        <input
          className={OPS_FILTER_FIELD_CLASS}
          value={search.discordId ?? ""}
          onChange={(e) => update({ discordId: e.target.value || undefined })}
          placeholder="Partial match"
        />
      </OpsFilterField>
      <OpsFilterField label="Tag">
        <select
          className={OPS_FILTER_FIELD_CLASS}
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
      </OpsFilterField>
      <OpsFilterField label="Account status">
        <select
          className={OPS_FILTER_FIELD_CLASS}
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
      </OpsFilterField>
    </OpsFilterBar>
  );
}
