import { Link } from "@tanstack/react-router";
import { PageShell } from "@/components/page-shell";
import { BankSubNav } from "@/components/bank/bank-sub-nav";
import { CREDIT_DESK_CLOSED_PAGE } from "@/lib/platform/credit-desk-copy";

export function CreditDeskClosedPage() {
  return (
    <PageShell eyebrow="Alta Bank · Credit Desk" title={CREDIT_DESK_CLOSED_PAGE.title}>
      <BankSubNav />
      <div className="mx-auto max-w-lg rounded-xl border border-border bg-surface-1/80 px-8 py-10 text-center">
        <p className="text-[15px] leading-relaxed text-muted-foreground">{CREDIT_DESK_CLOSED_PAGE.body}</p>
        <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground">
          {CREDIT_DESK_CLOSED_PAGE.servicingNote}
        </p>
        <p className="mt-6 text-[13px] text-muted-foreground">{CREDIT_DESK_CLOSED_PAGE.submissionNote}</p>
        <Link
          to="/bank"
          className="mt-8 inline-flex rounded-md border border-border bg-surface-2 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] hover:bg-surface-1"
        >
          Back to Banking Overview
        </Link>
      </div>
    </PageShell>
  );
}
