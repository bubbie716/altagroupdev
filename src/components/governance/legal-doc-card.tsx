import { Link } from "@tanstack/react-router";
import { Card } from "@/components/page-shell";
import type { LegalDocMeta } from "@/lib/governance/legal-docs-catalog";
import { cn } from "@/lib/utils";

function kindLabel(kind: LegalDocMeta["kind"]): string {
  if (kind === "corporate") return "Corporate";
  if (kind === "template") return "Template";
  return "Legal";
}

/** Compact catalog card — equal row height without oversized empty slots. */
export function LegalDocCard({ doc }: { doc: LegalDocMeta }) {
  return (
    <Link
      to="/legal/$docId"
      params={{ docId: doc.id }}
      className="group block"
    >
      <Card className="flex flex-col transition-colors group-hover:border-border">
        <div className="type-meta">{doc.id}</div>
        <h3 className="mt-3 min-h-[2.75rem] text-xl font-semibold leading-snug tracking-tight">
          {doc.title}
        </h3>
        <div className="mt-2 font-mono text-[11px] leading-snug text-muted-foreground">
          {doc.entity}
        </div>
        <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {kindLabel(doc.kind)}
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">{doc.description}</p>
        <div
          className={cn(
            "mt-4 text-[12px] text-muted-foreground transition-colors group-hover:text-foreground",
          )}
        >
          Read document →
        </div>
      </Card>
    </Link>
  );
}
