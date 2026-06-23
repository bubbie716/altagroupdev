import { Card } from "@/components/page-shell";

const modules = [
  {
    title: "Business Banking",
    description:
      "Business banking will become available after company verification.",
  },
  {
    title: "IPO / Listing",
    description: "Listing applications require company verification.",
  },
  {
    title: "Issuer Portal",
    description: "Issuer tools will become available after listing approval.",
  },
  {
    title: "API Access",
    description: "Developer access requires Alta approval.",
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
              Preview
            </span>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{m.description}</p>
        </Card>
      ))}
    </div>
  );
}
