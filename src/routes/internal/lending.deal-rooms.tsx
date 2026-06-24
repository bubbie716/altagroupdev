import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalStatCard } from "@/components/internal/internal-stat-card";
import { Florin } from "@/components/ui/florin";
import { EmptyState } from "@/components/shared/empty-state";
import { DealStatusBadge } from "@/components/bank/deal-room/deal-room-bits";
import { listDealRooms, DEAL_ROOM_STATUS_LABELS, type DealRoomStatus } from "@/lib/bank/deal-rooms-mock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/internal/lending/deal-rooms")({
  head: () => ({ meta: [{ title: "Deal Rooms — Alta Internal" }] }),
  component: InternalDealRooms,
});

function InternalDealRooms() {
  const rooms = listDealRooms();
  const [statusFilter, setStatusFilter] = useState<DealRoomStatus | "all">("all");
  const [officerFilter, setOfficerFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("all");

  const officers = useMemo(
    () => Array.from(new Set(rooms.map((r) => r.officer))),
    [rooms],
  );
  const products = useMemo(
    () => Array.from(new Set(rooms.map((r) => r.product))),
    [rooms],
  );

  const filtered = rooms.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (officerFilter !== "all" && r.officer !== officerFilter) return false;
    if (productFilter !== "all" && r.product !== productFilter) return false;
    return true;
  });

  const awaitingOfficer = rooms.filter((r) => r.nextActor === "Officer" || r.nextActor === "Underwriter").length;
  const negotiating = rooms.filter((r) => r.status === "negotiating").length;
  const readyToSign = rooms.filter((r) => r.status === "ready_for_signature").length;

  return (
    <InternalPageShell
      title="Deal Rooms"
      description="Underwriting workspace — every active credit negotiation, term sheet, and contract package."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InternalStatCard label="Active rooms" value={String(rooms.length)} />
        <InternalStatCard label="Awaiting officer" value={String(awaitingOfficer)} alert={awaitingOfficer > 0} />
        <InternalStatCard label="Negotiating" value={String(negotiating)} />
        <InternalStatCard label="Ready for signature" value={String(readyToSign)} />
      </div>

      <Section title="Filters" className="mt-10">
        <div className="flex flex-wrap gap-3 rounded-lg border border-border bg-surface-1/60 p-3">
          <FilterSelect
            label="Status"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as DealRoomStatus | "all")}
            options={[
              { value: "all", label: "All statuses" },
              ...Object.entries(DEAL_ROOM_STATUS_LABELS).map(([value, label]) => ({ value, label })),
            ]}
          />
          <FilterSelect
            label="Officer"
            value={officerFilter}
            onChange={setOfficerFilter}
            options={[{ value: "all", label: "All officers" }, ...officers.map((o) => ({ value: o, label: o }))]}
          />
          <FilterSelect
            label="Product"
            value={productFilter}
            onChange={setProductFilter}
            options={[{ value: "all", label: "All products" }, ...products.map((p) => ({ value: p, label: p }))]}
          />
        </div>
      </Section>

      <Section title="Deal rooms" className="mt-10">
        {filtered.length === 0 ? (
          <EmptyState
            tag="No matches"
            title="No deal rooms match these filters"
            description="Adjust the filters above to see additional underwriting work."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface-1/80">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-border bg-surface-2/40">
                <tr className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  <th className="px-4 py-3">Room</th>
                  <th className="px-4 py-3">Borrower</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3 text-right">Requested</th>
                  <th className="px-4 py-3 text-right">Proposed</th>
                  <th className="px-4 py-3">Officer</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last activity</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 last:border-b-0 hover:bg-surface-2/30">
                    <td className="px-4 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground">
                      <Link
                        to="/bank/lending/deal-rooms/$dealRoomId"
                        params={{ dealRoomId: r.id }}
                        className="hover:text-gold"
                      >
                        {r.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-foreground">{r.company ?? r.applicant}</div>
                      {r.company ? (
                        <div className="text-[11px] text-muted-foreground">{r.applicant}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.product}</td>
                    <td className="px-4 py-3 text-right">
                      <Florin value={r.requested.amount} fractionDigits={0} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.proposed.amount > 0 ? (
                        <Florin value={r.proposed.amount} fractionDigits={0} />
                      ) : (
                        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-foreground">{r.officer}</td>
                    <td className="px-4 py-3">
                      <DealStatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.lastActivityLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Officer controls" className="mt-10">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            "Open deal room",
            "Update proposed rate",
            "Update proposed amount",
            "Issue term sheet",
            "Request documents",
            "Mark under review",
            "Mark ready for signature",
            "Approve",
            "Decline",
            "Close deal room",
          ].map((label) => (
            <button
              key={label}
              type="button"
              className={cn(
                "rounded-md border border-border bg-surface-1 px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
                "hover:border-gold/40 hover:bg-gold/5 hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/80">
          Controls render only — backend wiring coming soon
        </p>
      </Section>
    </InternalPageShell>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-background px-2 py-1.5 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}