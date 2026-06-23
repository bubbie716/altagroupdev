import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export function TransfersBackLink() {
  return (
    <Link
      to="/bank/transfers"
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2/40 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground transition-colors hover:border-border-strong hover:bg-surface-2"
    >
      <ArrowLeft className="size-3.5" />
      All transfers
    </Link>
  );
}

export function TransferPageHeader({ title }: { title?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-4 ${title ? "mb-4" : "mb-6"}`}>
      <TransfersBackLink />
      {title && (
        <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          {title}
        </h2>
      )}
    </div>
  );
}
