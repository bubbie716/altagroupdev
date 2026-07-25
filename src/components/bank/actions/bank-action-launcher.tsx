"use client";

import type { ReactNode } from "react";
import { useBankActionLauncher } from "@/components/bank/actions/use-bank-action-launcher";
import type { BankActionId } from "@/lib/bank/bank-action-ids";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function BankActionLauncher({
  action,
  accountId,
  cardId,
  companyId,
  scope,
  disabled,
  className,
  variant = "outline",
  size = "sm",
  children,
}: {
  action: BankActionId;
  accountId?: string;
  cardId?: string;
  companyId?: string;
  scope?: "personal" | "all";
  disabled?: boolean;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary" | "link" | "gold" | "institutional" | "destructive";
  size?: "default" | "sm" | "lg" | "icon";
  children: ReactNode;
}) {
  const { openAction } = useBankActionLauncher();

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      disabled={disabled}
      className={cn("h-10 min-w-11 gap-1.5 px-3 text-[13px] font-medium", className)}
      onClick={(event) => {
        openAction(
          action,
          { accountId, cardId, companyId, scope },
          { fromElement: event.currentTarget },
        );
      }}
    >
      {children}
    </Button>
  );
}
