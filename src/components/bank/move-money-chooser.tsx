"use client";

import { ArrowLeftRight, Send } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useControlledMenu } from "@/hooks/use-controlled-menu";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useBankActionLauncher } from "@/components/bank/actions/use-bank-action-launcher";
import { cn } from "@/lib/utils";

/**
 * Move money entry — opens the shared action overlay (chooser / transfer / pay).
 */
export function MoveMoneyChooser({
  disabled,
  triggerClassName,
  accountId,
  companyId,
  scope,
  children,
}: {
  disabled?: boolean;
  triggerClassName?: string;
  accountId?: string;
  companyId?: string;
  scope?: "personal" | "all";
  children: ReactNode;
}) {
  const menu = useControlledMenu();
  const { openAction } = useBankActionLauncher();

  const extras = {
    accountId,
    companyId,
    scope,
  };

  function launch(action: "move-money" | "transfer" | "pay", fromElement?: HTMLElement | null) {
    menu.runAfterClose(() => {
      openAction(action, extras, { fromElement });
    });
  }

  const triggerClass = cn("h-10 min-w-11 gap-1.5 px-3 text-[13px] font-medium", triggerClassName);

  return (
    <>
      <div className="hidden md:block">
        <DropdownMenu modal={false} open={menu.open} onOpenChange={disabled ? undefined : menu.setOpen}>
          <DropdownMenuTrigger asChild>
            <Button type="button" size="sm" disabled={disabled} className={triggerClass}>
              {children}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 bg-[var(--menu-surface)]"
            onCloseAutoFocus={(event) => {
              if (menu.isNavigating()) event.preventDefault();
            }}
          >
            <DropdownMenuLabel className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Move money
            </DropdownMenuLabel>
            <DropdownMenuItem className="cursor-pointer" onSelect={() => launch("transfer")}>
              <ArrowLeftRight className="mr-2 size-3.5" />
              Between my accounts
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onSelect={() => launch("pay")}>
              <Send className="mr-2 size-3.5" />
              Pay someone
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="md:hidden">
        <Button
          type="button"
          size="sm"
          disabled={disabled}
          className={triggerClass}
          onClick={(event) => {
            openAction("move-money", extras, { fromElement: event.currentTarget });
          }}
        >
          {children}
        </Button>
      </div>
    </>
  );
}
