"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { OrderTicket } from "@/components/terminal/order-ticket";
import { MobileTradeActionBar } from "@/components/terminal/mobile-trade-action-bar";
import type { OrderTicketDraft } from "@/hooks/use-order-ticket-draft";
import type {
  Holding,
  OrderSide,
  SecurityDetail,
  TseDataSourceMode,
} from "@/lib/terminal/types";
import { focusDialogCloseButton } from "@/lib/ui/focus-dialog-close";
import { cn } from "@/lib/utils";

export type TicketSharedProps = {
  security: SecurityDetail;
  buyingPower: number;
  position: Holding | null;
  mode: TseDataSourceMode;
  marketClosed: boolean;
  portfolioId: string | null;
  portfolioLabel: string | null;
  canTradeSelected: boolean;
  tradeBlockedReason: string | null;
  onRequestPortfolioChange: () => void;
  onSubmitted: () => void;
  draft: OrderTicketDraft;
};

/** Mobile Buy/Sell chrome: sticky action bar + full order ticket in a bottom sheet. */
export function MobileOrderEntry({
  open,
  onOpenChange,
  onTrade,
  ticketProps,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTrade: (side: OrderSide) => void;
  ticketProps: TicketSharedProps;
  className?: string;
}) {
  return (
    <div className={cn(className)}>
      {!open ? <MobileTradeActionBar onTrade={onTrade} /> : null}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          overlayClassName={cn(
            "z-[125] data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0 data-[state=closed]:animate-none",
          )}
          className={cn(
            "z-[125] gap-0 rounded-t-xl border-[var(--terminal-border)] bg-[var(--menu-surface)] p-0 text-[var(--terminal-text)]",
            "bottom-[calc(3.25rem+env(safe-area-inset-bottom,0px))] max-h-[min(85dvh,calc(100dvh-7.5rem))] overflow-hidden md:bottom-0",
            "data-[state=open]:animate-none data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0 data-[state=closed]:animate-none",
          )}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            focusDialogCloseButton(event.currentTarget);
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
          }}
        >
          <SheetHeader className="border-b border-[var(--terminal-border)] px-4 py-3 pr-14 text-left">
            <SheetTitle className="text-[16px] font-medium text-[var(--terminal-text)]">
              {ticketProps.draft.side === "sell" ? "Sell" : "Buy"} {ticketProps.security.symbol}
            </SheetTitle>
            <SheetDescription className="text-[12px] text-[var(--terminal-muted)]">
              Review size and portfolio before submitting.
            </SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto overscroll-contain p-3 pb-5">
            <OrderTicket {...ticketProps} compact className="border-0 bg-transparent p-0" />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
