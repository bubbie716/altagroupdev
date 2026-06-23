import { Card } from "@/components/page-shell";
import { MockActionButton } from "@/components/internal/mock-action-button";

const modules = [
  {
    title: "Business Banking",
    description: "Treasury accounts, wires, and institutional deposit products for registered entities.",
    status: "Preview",
  },
  {
    title: "IPO / Listing",
    description: "Listing applications, regulatory review, and Alta Exchange onboarding.",
    status: "Preview",
  },
  {
    title: "Issuer Portal",
    description: "Corporate announcements, financial updates, and investor communications.",
    status: "Preview",
  },
  {
    title: "API Access",
    description: "Licensed market data and institutional integration credentials.",
    status: "Preview",
  },
] as const;

export function CompanyFutureModules() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {modules.map((m) => (
        <Card key={m.title} className="!p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-medium tracking-tight">{m.title}</h3>
            <span className="rounded bg-surface-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {m.status}
            </span>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{m.description}</p>
          <div className="mt-4">
            <MockActionButton label="Open module" />
          </div>
        </Card>
      ))}
    </div>
  );
}
