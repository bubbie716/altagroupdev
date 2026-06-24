import { ArrowLeft } from "lucide-react";
import { RouteButton } from "@/components/bank/route-button";

export function TransfersBackLink({ accountId }: { accountId?: string }) {
  return (
    <RouteButton
      to="/bank/transfers/"
      search={accountId ? { accountId } : undefined}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2/40 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground transition-colors hover:border-border-strong hover:bg-surface-2"
    >
      <ArrowLeft className="size-3.5" />
      All options
    </RouteButton>
  );
}

export function TransferPageHeader({ title, accountId }: { title?: string; accountId?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-4 ${title ? "mb-4" : "mb-6"}`}>
      <TransfersBackLink accountId={accountId} />
      {title && (
        <h2 className="type-section-title">
          {title}
        </h2>
      )}
    </div>
  );
}
