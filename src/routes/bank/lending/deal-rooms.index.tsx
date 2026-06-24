import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell, Section } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { LendingSubNav } from "@/components/bank/lending-sub-nav";
import { Florin } from "@/components/ui/florin";
import { EmptyState } from "@/components/shared/empty-state";
import { DealStatusBadge } from "@/components/bank/deal-room/deal-room-bits";
import { listDealRooms } from "@/lib/bank/deal-rooms-mock";

export const Route = createFileRoute("/bank/lending/deal-rooms/")({
  head: () => ({ meta: [{ title: "Deal Rooms — Alta Bank Lending" }] }),
  component: DealRoomDirectory,
});

function DealRoomDirectory() {
  const rooms = listDealRooms();

  return (
    <PageShell
      eyebrow="Alta Bank · Lending"
      title="Secure Deal Rooms"
      description="Private workspaces where applicants, company representatives, and Alta loan officers structure each credit facility."
    >
      <BankSubNav />
      <LendingSubNav />

      <Section title="Active deal rooms">
        {rooms.length === 0 ? (
          <EmptyState
            tag="No deal rooms"
            title="No active deal rooms"
            description="Once you submit a credit application, a private deal room will open here for negotiation and contracting."
          />
        ) : (
          <ul className="grid gap-4 lg:grid-cols-2">
            {rooms.map((r) => (
              <li key={r.id}>
                <Link
                  to="/bank/lending/deal-rooms/$dealRoomId"
                  params={{ dealRoomId: r.id }}
                  className="group block rounded-xl border border-border bg-surface-1/80 p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-elevated"
                >
                  <header className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {r.id} · {r.product}
                      </div>
                      <h3 className="mt-1 truncate font-serif text-xl text-foreground">
                        {r.company ?? r.applicant}
                      </h3>
                      <div className="mt-0.5 text-[12px] text-muted-foreground">
                        {r.company ? `Applicant: ${r.applicant}` : r.applicantHandle}
                      </div>
                    </div>
                    <DealStatusBadge status={r.status} className="shrink-0" />
                  </header>

                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-border/60 py-4 text-[13px]">
                    <Field label="Requested">
                      <Florin value={r.requested.amount} fractionDigits={0} />
                    </Field>
                    <Field label="Proposed">
                      {r.proposed.amount > 0 ? (
                        <Florin value={r.proposed.amount} fractionDigits={0} />
                      ) : (
                        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          Pending
                        </span>
                      )}
                    </Field>
                    <Field label="Proposed rate">
                      <span className="font-mono tabular">
                        {r.proposed.monthlyRate ? `${r.proposed.monthlyRate.toFixed(2)}% / mo` : "—"}
                      </span>
                    </Field>
                    <Field label="Loan officer">
                      <span>{r.officer}</span>
                    </Field>
                  </dl>

                  <footer className="mt-4 flex flex-wrap items-end justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                        Next action
                      </div>
                      <div className="mt-0.5 truncate text-[13px] text-foreground">{r.nextAction}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                        Last activity
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                        {r.lastActivityLabel}
                      </div>
                    </div>
                  </footer>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </PageShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}