import { createFileRoute, Link } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { AdminDataTable } from "@/components/internal/admin-data-table";
import { OpsConfirmDialog } from "@/components/internal/ops-confirm-dialog";
import { searchAltaPayAdmin, reverseAltaPayAdmin } from "@/lib/internal/ops-platform.functions";
import type { AltaPayAdminRow } from "@/lib/internal/ops-types";
import { florin } from "@/lib/bank/api";
import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

export type AltaPaySearch = { q?: string; ref?: string };

export const Route = createFileRoute("/internal/bank/alta-pay/")({
  validateSearch: (s: Record<string, unknown>): AltaPaySearch => ({
    q: typeof s.q === "string" && s.q.trim() ? s.q.trim() : undefined,
    ref: typeof s.ref === "string" && s.ref.trim() ? s.ref.trim() : undefined,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    searchAltaPayAdmin({
      data: { q: deps.ref ?? deps.q, limit: 50, offset: 0 },
    }),
  component: AltaPayOpsPage,
});

function AltaPayOpsPage() {
  const result = Route.useLoaderData();
  const search = Route.useSearch();
  const router = useRouter();
  const reverseFn = useServerFn(reverseAltaPayAdmin);
  const [reverseRef, setReverseRef] = useState<string | null>(null);

  return (
    <InternalPageShell title="Alta Pay Operations" description="Merchant payment ledger, search, and reversals.">
      <form className="mb-6 flex flex-wrap gap-3">
        <input name="q" defaultValue={search.q ?? search.ref ?? ""} placeholder="Reference, merchant, account…" className="min-w-[220px] flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <button type="submit" className="rounded-md bg-foreground px-4 py-2 text-[12px] text-background">Search</button>
        <Link to="/internal/bank/alta-pay" className="rounded-md border border-border px-4 py-2 text-[12px]">Clear</Link>
      </form>

      <Section title={`${result.total} payment(s)`}>
        <AdminDataTable
          columns={[
            { key: "ref", header: "Reference", cell: (r: AltaPayAdminRow) => <span className="font-mono text-[11px]">{r.referenceCode}</span> },
            { key: "payer", header: "Payer", cell: (r) => r.payerLabel },
            { key: "merchant", header: "Merchant", cell: (r) => r.merchantName },
            { key: "amount", header: "Amount", cell: (r) => florin(r.amount) },
            { key: "status", header: "Status", cell: (r) => r.status },
            { key: "date", header: "Date", cell: (r) => <span className="font-mono text-[11px]">{r.createdAt.slice(0, 19).replace("T", " ")}</span> },
            {
              key: "actions",
              header: "",
              cell: (r) => (
                <div className="flex gap-1">
                  <Link to="/internal/bank/transactions/$transactionId" params={{ transactionId: r.outTransactionId }} className="font-mono text-[10px] uppercase text-gold">
                    View
                  </Link>
                  {r.status === "APPROVED" ? (
                    <button type="button" className="font-mono text-[10px] uppercase text-destructive" onClick={() => setReverseRef(r.referenceCode)}>
                      Reverse
                    </button>
                  ) : null}
                </div>
              ),
            },
          ]}
          rows={result.items}
          rowKey={(r) => r.referenceCode}
        />
      </Section>

      <OpsConfirmDialog
        open={reverseRef != null}
        title="Reverse Alta Pay payment"
        description={reverseRef ? `Reverse payment ${reverseRef}. This creates offsetting transactions.` : undefined}
        confirmLabel="Reverse payment"
        variant="danger"
        onCancel={() => setReverseRef(null)}
        onConfirm={async (reason) => {
          if (!reverseRef) return;
          await reverseFn({ data: { referenceCode: reverseRef, reason } });
          setReverseRef(null);
          await router.invalidate();
        }}
      />
    </InternalPageShell>
  );
}
