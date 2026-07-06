import { Card } from "@/components/page-shell";
import type { LeadershipCard } from "@/lib/governance/content";
import { cn } from "@/lib/utils";

export function LeadershipRoleCard({ role }: { role: LeadershipCard }) {
  const appointed = role.status === "Appointed";

  return (
    <Card className="flex h-full flex-col">
      <div className="type-meta">
        {role.title}
      </div>
      <div className="mt-4 text-xl font-semibold tracking-tight">
        {role.name ?? "Vacant"}
        {role.minecraftUsername ? (
          <span className="ml-1.5 font-mono text-base font-normal text-muted-foreground">
            ({role.minecraftUsername})
          </span>
        ) : null}
      </div>
      <div
        className={cn(
          "mt-3 font-mono text-[10px] uppercase tracking-[0.2em]",
          appointed ? "text-[var(--success)]" : "text-muted-foreground",
        )}
      >
        {role.status}
      </div>
      <p className="mt-5 text-[13px] leading-relaxed text-muted-foreground">{role.responsibility}</p>
    </Card>
  );
}
