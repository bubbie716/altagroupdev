"use client";

import { useMemo, useState } from "react";
import type { PortalAuditRow } from "@/lib/ncc/portal-types";
import { PortalPageHeader } from "@/components/ncc/portal/portal-shell";
import { PortalEnterpriseTable } from "@/components/ncc/portal/portal-enterprise-table";
import { formatPortalDate } from "@/components/ncc/portal/portal-status-badge";

export function PortalAuditView({ rows }: { rows: PortalAuditRow[] }) {
  const [q, setQ] = useState("");
  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");

  const actors = useMemo(
    () => [...new Set(rows.map((row) => row.actorUsername))].sort(),
    [rows],
  );
  const actions = useMemo(
    () => [...new Set(rows.map((row) => row.action))].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (actor && row.actorUsername !== actor) return false;
      if (action && row.action !== action) return false;
      if (!q.trim()) return true;
      const hay = `${row.action} ${row.description} ${row.actorUsername} ${row.entityType}`.toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    });
  }, [rows, q, actor, action]);

  return (
    <div>
      <PortalPageHeader
        eyebrow="Compliance"
        title="Audit Log"
        description="Read-only institution audit history. Filters apply client-side to the loaded window."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search action, actor, or target"
          className="h-9 w-full max-w-xs rounded-sm border border-[#e5e7eb] bg-white px-3 text-[13px] outline-none focus:border-[#0c4d32]/40"
          aria-label="Search audit log"
        />
        <select
          value={actor}
          onChange={(event) => setActor(event.target.value)}
          className="h-9 rounded-sm border border-[#e5e7eb] bg-white px-3 text-[13px]"
          aria-label="Filter by actor"
        >
          <option value="">All actors</option>
          {actors.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={action}
          onChange={(event) => setAction(event.target.value)}
          className="h-9 rounded-sm border border-[#e5e7eb] bg-white px-3 text-[13px]"
          aria-label="Filter by action"
        >
          <option value="">All actions</option>
          {actions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <PortalEnterpriseTable
        rows={filtered}
        emptyTitle="No audit events"
        emptyDescription="NCC audit events for this institution will appear here."
        columns={[
          {
            key: "time",
            header: "Time",
            render: (row) => formatPortalDate(row.createdAt),
          },
          {
            key: "actor",
            header: "Actor",
            render: (row) => row.actorUsername,
          },
          {
            key: "action",
            header: "Action",
            render: (row) => row.action.replace(/^NCC_/, ""),
          },
          {
            key: "target",
            header: "Target",
            render: (row) => (
              <span className="text-[#4b5563]">
                {row.entityType}
                {row.entityId ? ` · ${row.entityId.slice(0, 12)}` : ""}
              </span>
            ),
          },
          {
            key: "result",
            header: "Result",
            render: () => "Recorded",
          },
          {
            key: "reason",
            header: "Reason",
            render: (row) => <span className="line-clamp-2 text-[#4b5563]">{row.description}</span>,
          },
        ]}
      />
    </div>
  );
}
