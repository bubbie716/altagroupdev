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
import { withInternalSiteSearch } from "@/lib/internal/internal-route-search";

export function InternalUserFilters({
  search,
  onAttentionChange,
}: {
  search: InternalUsersSearch;
  onAttentionChange?: (attention: string | undefined) => void;
}) {
  const navigate = useNavigate({ from: "/internal/users" });

  function update(partial: Partial<InternalUsersSearch>) {
    void navigate({
      search: (prev: InternalUsersSearch) =>
        withInternalSiteSearch({ ...prev, ...partial }, prev.site ?? search.site),
      replace: true,
    });
  }

  function clearFilters() {
    void navigate({
      search: withInternalSiteSearch({}, search.site),
      replace: true,
    });
  }

  const hasFilters = Boolean(
    search.q || search.discordId || search.tag || search.accountStatus || search.attention,
  );

  return (
    <OpsFilterBar onClear={hasFilters ? clearFilters : undefined}>
      <OpsFilterField label="Search">
        <input
          className={OPS_FILTER_FIELD_CLASS}
          value={search.q ?? ""}
          onChange={(e) => update({ q: e.target.value || undefined })}
          placeholder="Customer name…"
          aria-label="Search customers"
        />
      </OpsFilterField>
      <OpsFilterField label="Standing">
        <select
          className={OPS_FILTER_FIELD_CLASS}
          value={search.accountStatus ?? ""}
          onChange={(e) =>
            update({ accountStatus: (e.target.value || undefined) as AccountStatus | undefined })
          }
          aria-label="Filter by standing"
        >
          <option value="">All standings</option>
          {ALL_ACCOUNT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {formatAccountStatus(status)}
            </option>
          ))}
        </select>
      </OpsFilterField>
      <OpsFilterField label="Needs attention">
        <select
          className={OPS_FILTER_FIELD_CLASS}
          value={search.attention ?? ""}
          onChange={(e) => {
            const attention = e.target.value === "1" ? "1" : undefined;
            if (onAttentionChange) onAttentionChange(attention);
            else update({ attention });
          }}
          aria-label="Needs attention filter"
        >
          <option value="">Any</option>
          <option value="1">Needs attention</option>
        </select>
      </OpsFilterField>
      <OpsFilterField label="Staff tag">
        <select
          className={OPS_FILTER_FIELD_CLASS}
          value={search.tag ?? ""}
          onChange={(e) => update({ tag: (e.target.value || undefined) as UserTag | undefined })}
          aria-label="Filter by staff tag"
        >
          <option value="">All tags</option>
          {ALL_USER_TAGS.map((tag) => (
            <option key={tag} value={tag}>
              {formatUserTag(tag)}
            </option>
          ))}
        </select>
      </OpsFilterField>
    </OpsFilterBar>
  );
}
