import { useNavigate } from "@tanstack/react-router";
import type { BusinessTreasuryCompany } from "@/lib/bank/business-banking-types";
import { florin } from "@/lib/bank/api";

export function BusinessCompanyPicker({
  companies,
  selectedCompanyId,
}: {
  companies: BusinessTreasuryCompany[];
  selectedCompanyId: string;
}) {
  const navigate = useNavigate();
  const selected = companies.find((c) => c.companyId === selectedCompanyId);

  if (companies.length <= 1) {
    if (!selected) return null;
    return (
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border/60 bg-surface-1 px-4 py-3">
        <div>
          <div className="type-meta">
            Treasury entity
          </div>
          <div className="mt-1 text-sm font-medium">{selected.companyName}</div>
        </div>
        <div className="text-right">
          <div className="type-meta">
            Operating account
          </div>
          <div className="mt-1 font-mono text-sm tabular-nums">
            {florin(selected.operatingAccount.balance)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="type-meta">
          Treasury entity
        </span>
        <select
          value={selectedCompanyId}
          onChange={(e) => {
            void navigate({
              to: ".",
              search: (prev: { companyId?: string }) => ({ ...prev, companyId: e.target.value }),
            });
          }}
          className="mt-2 block w-full max-w-full rounded-md border border-border bg-background px-3 py-2 text-sm shadow-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold/40"
        >
          {companies.map((c) => (
            <option key={c.companyId} value={c.companyId}>
              {c.companyName}
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <div className="rounded-md border border-border/60 bg-surface-1 px-4 py-2">
          <div className="type-meta">
            Operating balance
          </div>
          <div className="mt-0.5 font-mono text-sm tabular-nums">{florin(selected.operatingAccount.balance)}</div>
        </div>
      )}
    </div>
  );
}

export function BusinessPermissionBadge({
  permissions,
}: {
  permissions: BusinessTreasuryCompany["permissions"];
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <span className="rounded-full border border-border px-2.5 py-0.5 type-meta">
        {permissions.roleLabel}
      </span>
      {permissions.viewOnly && (
        <span className="rounded-full border border-gold/30 bg-gold/5 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-gold">
          View only
        </span>
      )}
    </div>
  );
}
