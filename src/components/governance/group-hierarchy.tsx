import { FadeIn } from "@/components/ui/fade-in";
import { AltaLogo } from "@/components/alta-logo";
import type { EntityStatus, HierarchyNode } from "@/lib/governance/content";

function statusTone(status: EntityStatus): string {
  if (status === "Operational") return "text-[var(--success)]";
  if (status === "Discontinued") return "text-muted-foreground";
  return "text-muted-foreground";
}

function HierarchyCard({
  node,
  compact = false,
  delay = 0,
  className = "",
}: {
  node: HierarchyNode;
  compact?: boolean;
  delay?: number;
  className?: string;
}) {
  const Icon = node.icon;
  const muted =
    node.status === "Planned" ||
    node.status === "In Development" ||
    node.status === "Release Candidate" ||
    node.status === "Discontinued";

  return (
    <FadeIn
      delay={delay}
      className={`flex h-full min-h-[7.5rem] flex-col rounded-xl border border-border bg-background/80 shadow-card transition-all duration-300 hover:border-border-strong hover:-translate-y-0.5 hover:shadow-elevated ${
        compact ? "p-4" : "p-5"
      } ${muted ? "opacity-90" : ""} ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className={`flex shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 text-gold ${
            compact ? "size-8" : "size-9"
          }`}
        >
          <Icon className={compact ? "size-3.5" : "size-4"} />
        </div>
        <span
          className={`font-mono uppercase tracking-[0.18em] ${statusTone(node.status)} ${
            compact ? "text-[8px]" : "text-[9px]"
          }`}
        >
          {node.status}
        </span>
      </div>
      <div className={`font-semibold tracking-tight ${compact ? "mt-3 text-sm" : "mt-4 text-base"}`}>
        {node.name}
      </div>
      <p
        className={`mt-1.5 flex-1 leading-snug text-muted-foreground ${
          compact ? "text-[11px]" : "text-[12px]"
        }`}
      >
        {node.description}
      </p>
    </FadeIn>
  );
}

export function GroupHierarchy({ nodes }: { nodes: HierarchyNode[] }) {
  return (
    <div className="paper-grain relative rounded-2xl border border-border-strong bg-surface-1/70 p-8 shadow-elevated md:p-12">
      <div className="flex flex-col items-center">
        <FadeIn className="flex items-center gap-5 rounded-xl border border-border-strong bg-surface-2 px-8 py-5 shadow-elevated">
          <AltaLogo className="h-10 w-10" />
          <div>
            <div className="text-xl font-semibold uppercase tracking-[0.06em] leading-none md:text-2xl">
              Alta Group <span className="text-muted-foreground">N.V.</span>
            </div>
            <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.24em] text-gold">
              Parent holding company
            </div>
          </div>
        </FadeIn>

        <div className="relative my-8 h-14 w-full max-w-4xl">
          <div className="absolute left-1/2 top-0 h-7 w-px -translate-x-1/2 bg-border-strong" />
          <div className="absolute left-[12.5%] right-[12.5%] top-7 h-px bg-border-strong" />
          <div className="absolute left-[12.5%] top-7 h-7 w-px bg-border-strong" />
          <div className="absolute left-[37.5%] top-7 h-7 w-px -translate-x-1/2 bg-border-strong" />
          <div className="absolute left-[62.5%] top-7 h-7 w-px -translate-x-1/2 bg-border-strong" />
          <div className="absolute left-[87.5%] top-7 h-7 w-px -translate-x-1/2 bg-border-strong" />
        </div>

        <div className="grid w-full max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:items-start">
          {nodes.map((node, i) => (
            <div
              key={node.name}
              className={`flex w-full flex-col gap-3 ${node.children?.length ? "items-center" : ""}`}
            >
              <HierarchyCard node={node} delay={0.08 + i * 0.06} className="w-full" />
              {node.children?.map((child, j) => (
                <div key={child.name} className="contents">
                  <div className="h-4 w-px shrink-0 bg-border-strong" aria-hidden />
                  <HierarchyCard
                    node={child}
                    compact
                    delay={0.14 + i * 0.06 + j * 0.04}
                    className="w-full"
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
