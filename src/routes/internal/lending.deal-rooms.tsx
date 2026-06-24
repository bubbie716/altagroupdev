import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalStatCard } from "@/components/internal/internal-stat-card";
import {
  DealStatusBadge,
  MetaLabel,
} from "@/components/bank/deal-room/deal-room-bits";
import { EmptyState } from "@/components/shared/empty-state";
import { Florin } from "@/components/ui/florin";
import { cn } from "@/lib/utils";
import {
  DEAL_ROOM_STATUS_LABELS,
  MOCK_DEAL_ROOMS,
  formatPercent,
  type DealRoom,
  type DealRoomStatus,
} from "@/lib/bank/deal-rooms-mock";

export const Route = createFileRoute("/internal/lending/deal-rooms")({
  head: () => ({ meta: [{ title: "Deal Rooms — Alta Internal" }] }),
  component: InternalDealRooms,
});

const STATUS_FILTERS: Array<{ id: "all" | DealRoomStatus; label: string }> = [
  { id: "all", label: "All" },
  { id: "under_review", label: DEAL_ROOM_STATUS_LABELS.under_review },
  { id: "negotiating", label: DEAL_ROOM_STATUS_LABELS.negotiating },
  { id: "awaiting_applicant", label: DEAL_ROOM_STATUS_LABELS.awaiting_applicant },
  { id: "awaiting_officer", label: DEAL_ROOM_STATUS_LABELS.awaiting_officer },
  { id: "contract_drafting", label: DEAL_ROOM_STATUS_LABELS.contract_drafting },
  { id: "ready_for_signature", label: DEAL_ROOM_STATUS_LABELS.ready_for_signature },
  { id: "approved", label: DEAL_ROOM_STATUS_LABELS.approved },
];

function InternalDealRooms() {
  const rooms = MOCK_DEAL_ROOMS;

  const products = useMemo(
    () => Array.from(new Set(rooms.map((r) => r.loanProduct))),
    [rooms],
  );
  const officers = useMemo(
    () => Array.from(new Set(rooms.map((r) => r.assignedOfficer))),
    [rooms],
  );

  const [status, setStatus] = useState<"all" | DealRoomStatus>("all");
  const [product, setProduct] = useState<string>("all");
  const [officer, setOfficer] = useState<string>("all");
  const [query, setQuery] = useState("");

  const filtered = rooms.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (product !== "all" && r.loanProduct !== product) return false;
    if (officer !== "all" && r.assignedOfficer !== officer) return false;
    if (query) {
      const q = query.toLowerCase();
      const hay = `${r.applicant} ${r.company ?? ""} ${r.id}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const counts = {
    active: rooms.filter((r) =>
      ["under_review", "negotiating", "awaiting_applicant", "awaiting_officer"].includes(r.status),
    ).length,
    contracts: rooms.filter((r) =>
      ["contract_drafting", "ready_for_signature"].includes(r.status),
    ).length,
    approved: rooms.filter((r) => r.status === "approved").length,
    total: rooms.length,
  };

  return (
    <InternalPageShell
      title="Deal Rooms"
      description="Active credit negotiations across the Alta Bank desk. Monitor, intervene, and progress facilities to signature."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InternalStatCard label="Active negotiations" value={String(counts.active)} alert={counts.active > 0} />
        <InternalStatCard label="In contract" value={String(counts.contracts)} />
        <InternalStatCard label="Approved" value={String(counts.approved)} />
        <InternalStatCard label="Total rooms" value={String(counts.total)} />
      </div>

      <Section title="Filters" className="mt-10">
        <div className="rounded-xl border border-border bg-surface-1 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterSelect label="Status" value={status} onChange={(v) => setStatus(v as typeof status)}>
              {STATUS_FILTERS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="Product" value={product} onChange={setProduct}>
              <option value="all">All</option>
              {products.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="Officer" value={officer} onChange={setOfficer}>
              <option value="all">All</option>
              {officers.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </FilterSelect>
            <div>
              <MetaLabel>Search</MetaLabel>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Applicant, company, or ID"
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
              />
            </div>
          </div>
        </div>
      </Section>

      <Section title="Active Deal Rooms" className="mt-8">
        {filtered.length === 0 ? (
          <EmptyState
            tag="No matches"
            title="No Open Negotiations"
            description="No deal rooms match the selected filters."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface-1">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-surface-2/60 text-muted-foreground">
                <tr>
                  <Th>Room</Th>
                  <Th>Counterparty</Th>
                  <Th>Product</Th>
                  <Th className="text-right">Proposed</Th>
                  <Th className="text-right">Rate</Th>
                  <Th>Officer</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtered.map((room) => (
                  <OfficerRow key={room.id} room={room} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </InternalPageShell>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em]",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>;
}

function OfficerRow({ room }: { room: DealRoom }) {
  return (
    <tr className="hover:bg-surface-2/30">
      <Td>
        <Link
          to="/bank/lending/deal-rooms/$dealRoomId"
          params={{ dealRoomId: room.id }}
          className="font-mono text-[11px] uppercase tracking-[0.16em] text-foreground hover:text-gold"
        >
          {room.id}
        </Link>
      </Td>
      <Td>
        <div className="text-sm">{room.company ?? room.applicant}</div>
        {room.company ? (
          <div className="text-[11px] text-muted-foreground">{room.applicant}</div>
        ) : null}
      </Td>
      <Td className="text-[13px]">{room.loanProduct}</Td>
      <Td className="text-right">
        <Florin value={room.proposedAmount} fractionDigits={0} />
      </Td>
      <Td className="text-right tabular font-mono text-[13px]">
        {formatPercent(room.proposedRate)}
      </Td>
      <Td className="text-[13px]">{room.assignedOfficer}</Td>
      <Td>
        <DealStatusBadge status={room.status} />
      </Td>
      <Td className="text-right">
        <OfficerActionsMenu />
      </Td>
    </tr>
  );
}

function OfficerActionsMenu() {
  // Mock controls — wired in a future iteration to officer mutations.
  const actions = [
    "Open",
    "Update Rate",
    "Update Amount",
    "Issue Term Sheet",
    "Request Docs",
    "Mark Under Review",
    "Mark Ready",
    "Approve",
    "Decline",
    "Close",
  ];
  return (
    <details className="relative inline-block text-left">
      <summary className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-surface-2/60 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground">
        Actions
        <span aria-hidden>▾</span>
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-52 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-elevated">
        {actions.map((a) => (
          <button
            key={a}
            type="button"
            className="block w-full rounded-sm px-2 py-1.5 text-left text-[12px] hover:bg-surface-2/70"
          >
            {a}
          </button>
        ))}
      </div>
    </details>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <MetaLabel>{label}</MetaLabel>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
      >
        {children}
      </select>
    </div>
  );
}