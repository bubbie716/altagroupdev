import { createFileRoute, Link } from "@tanstack/react-router";
import { Section } from "@/components/page-shell";
import { InternalPageShell } from "@/components/internal/internal-page-shell";
import { fetchExceptionCenter } from "@/lib/internal/ops-platform.functions";
import { florin } from "@/lib/bank/api";

export const Route = createFileRoute("/internal/exceptions")({
  loader: () => fetchExceptionCenter(),
  head: () => ({ meta: [{ title: "Exception Center — Alta Internal" }] }),
  component: ExceptionCenterPage,
});

function ExceptionCenterPage() {
  const items = Route.useLoaderData();

  return (
    <InternalPageShell
      title="Exception Center"
      description="Daily workspace for balances, failures, and items requiring operator attention."
    >
      <Section title={`${items.length} open exception(s)`}>
        {items.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">No exceptions detected.</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <Link
                key={item.id}
                to={item.href}
                className="flex items-start justify-between gap-4 rounded-lg border border-border/60 bg-surface-1/60 px-4 py-3 transition-colors hover:border-gold/40"
              >
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {item.category.replace(/_/g, " ")} · {item.severity}
                  </div>
                  <div className="mt-1 text-[14px] font-medium">{item.title}</div>
                  <div className="text-[13px] text-muted-foreground">{item.detail}</div>
                </div>
                {item.amount != null ? (
                  <div className="type-finance shrink-0 text-[14px]">{florin(item.amount)}</div>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </Section>
    </InternalPageShell>
  );
}
