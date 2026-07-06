import { Link } from "@tanstack/react-router";
import { Card } from "@/components/page-shell";
import type { LegalDocMeta } from "@/lib/governance/legal-docs-catalog";
import { cn } from "@/lib/utils";

function kindLabel(kind: LegalDocMeta["kind"]): string {
  if (kind === "corporate") return "Corporate";
  if (kind === "template") return "Template";
  return "Legal";
}

export function LegalDocCard({ doc }: { doc: LegalDocMeta }) {
  return (
    <Link
      to="/governance/legaldocs/$docId"
      params={{ docId: doc.id }}
      className="group block h-full"
    >
      <Card className="flex h-full flex-col transition-colors group-hover:border-border">
        <div className="type-meta">{doc.id}</div>
        <div className="mt-4 text-xl font-semibold tracking-tight">{doc.title}</div>
        <div className="mt-2 font-mono text-[11px] text-muted-foreground">{doc.entity}</div>
        <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {kindLabel(doc.kind)}
        </div>
        <p className="mt-5 flex-1 text-[13px] leading-relaxed text-muted-foreground">{doc.description}</p>
        <div
          className={cn(
            "mt-5 text-[12px] text-muted-foreground transition-colors group-hover:text-foreground",
          )}
        >
          Read document →
        </div>
      </Card>
    </Link>
  );
}
