import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/page-shell";
import { RouteButton } from "@/components/bank/route-button";

const actions = [
  {
    title: "Transfer",
    description: "Send funds within Alta Bank — between your accounts or to another player.",
    buttonLabel: "Transfer funds",
    to: "/bank/transfers/" as const,
  },
  {
    title: "Deposit",
    description: "Submit a Florin deposit request with proof for manual review.",
    buttonLabel: "Submit deposit",
    to: "/bank/deposit" as const,
  },
  {
    title: "Withdraw",
    description: "Request a withdrawal from this account. Balance updates after approval.",
    buttonLabel: "Request withdrawal",
    to: "/bank/withdraw" as const,
  },
] as const;

export function AccountQuickActions({
  accountId,
  className = "",
}: {
  accountId: string;
  className?: string;
}) {
  return (
    <div className={`flex min-h-0 flex-1 flex-col gap-4 ${className}`}>
      {actions.map((action) => (
        <Card key={action.title} className="flex min-h-0 flex-1 flex-col !p-6">
          <div className="text-base font-medium tracking-tight">{action.title}</div>
          <p className="mt-2 flex-1 text-[13px] leading-relaxed text-muted-foreground">
            {action.description}
          </p>
          <RouteButton
            to={action.to}
            search={{ accountId }}
            className="mt-auto inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-surface-2/40 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground transition-colors hover:bg-surface-2"
          >
            {action.buttonLabel}
            <ArrowUpRight className="size-3.5" />
          </RouteButton>
        </Card>
      ))}
    </div>
  );
}
