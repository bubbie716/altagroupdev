import { Card, Section } from "@/components/page-shell";
import { CREDIT_PROFILE_PLACEHOLDERS } from "@/lib/bank/lending-progress";

export function AltaCreditProfilePlaceholder({ className }: { className?: string }) {
  return (
    <Section title="Alta Credit Profile" className={className}>
      <p className="mb-4 text-[13px] text-muted-foreground">
        Future credit intelligence will aggregate bank cash, portfolio value, and repayment history.
        No scores or pre-approvals are calculated in V1.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CREDIT_PROFILE_PLACEHOLDERS.map((item) => (
          <Card key={item.label} className="!p-4">
            <div className="type-meta-sm">
              {item.label}
            </div>
            <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-gold/80">
              {item.note}
            </div>
          </Card>
        ))}
      </div>
    </Section>
  );
}
