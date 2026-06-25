import { createFileRoute, Link } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { InternalManualInterestOps } from "@/components/bank/internal-manual-interest-ops";

export const Route = createFileRoute("/internal/bank/interest")({
  head: () => ({ meta: [{ title: "Manual Interest — Alta Internal" }] }),
  component: InternalManualInterest,
});

function InternalManualInterest() {
  return (
    <InternalPageShell
      title="Manual Account Interest"
      description="Apply promotional or adjustment interest credits to Alta Bank deposit accounts by category."
    >
      <Link
        to="/internal/bank"
        className="mb-6 inline-block font-mono text-[12px] text-gold hover:underline"
      >
        ← Bank ops
      </Link>

      <Section title="Interest application">
        <p className="mb-6 text-[13px] leading-relaxed text-muted-foreground">
          Credit interest manually by percentage or fixed amount across one or more account
          categories. Preview affected accounts before applying. Does not affect loan interest or
          scheduled automatic accrual.
        </p>
        <InternalManualInterestOps />
      </Section>
    </InternalPageShell>
  );
}
