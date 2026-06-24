import { Card } from "@/components/page-shell";

export function KeyStatsGrid({ stats }: { stats: { label: string; value: string }[] }) {
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
      {stats.map((s) => (
        <div key={s.label} className="bg-surface-1 px-5 py-4">
          <div className="type-meta-sm">
            {s.label}
          </div>
          <div className="tabular mt-1 text-[15px] font-medium">{s.value}</div>
        </div>
      ))}
    </div>
  );
}

export function CompanyMetaGrid({
  items,
}: {
  items: { label: string; value: string }[];
}) {
  return (
    <Card>
      <dl className="grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label}>
            <dt className="type-meta-sm">
              {item.label}
            </dt>
            <dd className="mt-1 text-[14px]">{item.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
