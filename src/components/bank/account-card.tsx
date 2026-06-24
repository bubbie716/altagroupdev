import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/page-shell";
import { florin } from "@/lib/bank/api";
import { RouteButton } from "@/components/bank/route-button";

type AccountCardData = {
  id?: string;
  name: string;
  product: string;
  accountNumber: string;
  routingNumber?: string;
  balance: number;
  status: string;
  recentActivity?: string;
};

export function AccountCard({
  account,
  footer = "activity",
}: {
  account: AccountCardData;
  footer?: "activity" | "view";
}) {
  const isActive = account.status === "Active" || account.status === "active";
  const statusLabel =
    account.status === "active"
      ? "Active"
      : account.status === "pending"
        ? "Pending Review"
        : account.status === "frozen"
          ? "Frozen"
          : account.status;

  return (
    <Card className="group flex h-full flex-col !p-6">
      <div className="flex items-start justify-between">
        <div className="type-meta">
          {account.product}
        </div>
        <span
          className={`font-mono text-[9px] uppercase tracking-[0.18em] ${
            isActive ? "text-[var(--success)]" : "text-muted-foreground"
          }`}
        >
          {statusLabel}
        </span>
      </div>
      <div className="mt-5 text-base font-medium tracking-tight">{account.name}</div>
      <div className="mt-1 font-mono text-[11px] text-muted-foreground">{account.accountNumber}</div>
      {account.routingNumber && (
        <div className="mt-1 font-mono text-[10px] text-muted-foreground/80">
          Routing {account.routingNumber}
        </div>
      )}
      <div className="tabular mt-4 text-2xl font-semibold tracking-tight">{florin(account.balance)}</div>
      {footer === "view" && account.id ? (
        <RouteButton
          to="/bank/account/$accountId"
          params={{ accountId: account.id }}
          className="mt-auto inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-surface-2/40 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground transition-colors hover:bg-surface-2"
        >
          View account
          <ArrowUpRight className="size-3.5" />
        </RouteButton>
      ) : (
        <>
          {account.recentActivity && (
            <div className="mt-4 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
              {account.recentActivity}
            </div>
          )}
          {account.id && (
            <RouteButton
              to="/bank/account/$accountId"
              params={{ accountId: account.id }}
              className="mt-5 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2/40 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-foreground transition-colors hover:bg-surface-2"
            >
              View account
              <ArrowUpRight className="size-3.5" />
            </RouteButton>
          )}
        </>
      )}
    </Card>
  );
}

export function OpenAccountCard() {
  return (
    <Card className="flex h-full flex-col !p-6">
      <div className="type-meta">
        Alta Bank
      </div>
      <div className="mt-5 text-base font-medium tracking-tight">Open an account</div>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
        Personal, savings, business, and private banking products.
      </p>
      <RouteButton
        to="/bank/open"
        className="mt-auto inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-foreground px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-background transition-opacity hover:opacity-90"
      >
        Open account
        <ArrowUpRight className="size-3.5" />
      </RouteButton>
    </Card>
  );
}
