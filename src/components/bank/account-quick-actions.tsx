"use client";

import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  ChevronRight,
  Send,
} from "lucide-react";
import { Card } from "@/components/page-shell";
import { BankActionLauncher } from "@/components/bank/actions/bank-action-launcher";
import { cn } from "@/lib/utils";

const actions = [
  {
    title: "Transfer",
    hint: "Between your Alta Bank accounts",
    action: "transfer" as const,
    icon: ArrowLeftRight,
  },
  {
    title: "Alta Pay",
    hint: "Send Florin to a person or business",
    action: "pay" as const,
    icon: Send,
  },
  {
    title: "Deposit",
    hint: "Submit a Florin deposit with proof",
    action: "deposit" as const,
    icon: ArrowDownToLine,
  },
  {
    title: "Withdraw",
    hint: "Request a withdrawal for review",
    action: "withdraw" as const,
    icon: ArrowUpFromLine,
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
    <Card className={cn("flex min-h-0 flex-col divide-y divide-border/50 !p-0", className)}>
      {actions.map((item) => {
        const Icon = item.icon;
        return (
          <BankActionLauncher
            key={item.title}
            action={item.action}
            accountId={accountId}
            variant="ghost"
            className="h-auto w-full justify-start gap-3 rounded-none px-4 py-3 text-left font-normal first:rounded-t-xl last:rounded-b-xl"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2/60 text-muted-foreground">
              <Icon className="size-3.5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium leading-tight">{item.title}</span>
              <span className="mt-0.5 block truncate text-[12px] font-normal text-muted-foreground">
                {item.hint}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </BankActionLauncher>
        );
      })}
    </Card>
  );
}
