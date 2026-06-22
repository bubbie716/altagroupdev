import { Card } from "@/components/page-shell";

export function PrivateTierCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <Card>
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-3 text-lg font-semibold tracking-tight">{value}</div>
      {detail && <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{detail}</p>}
    </Card>
  );
}
