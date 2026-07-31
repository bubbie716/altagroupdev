"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { focusDialogCloseButton } from "@/lib/ui/focus-dialog-close";
import { cn } from "@/lib/utils";

/**
 * Wallet details — public ID + copy only.
 * No Send/Receive, keys, or Create Wallet affordances.
 */
export function WalletDetailsSheet({
  open,
  onOpenChange,
  publicWalletId,
  walletStatus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publicWalletId: string;
  walletStatus: "ACTIVE" | "FROZEN" | "CLOSED" | null;
}) {
  const [copied, setCopied] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(publicWalletId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  const body = (
    <div className="space-y-4 text-[13px]">
      <div>
        <p className="text-[11px] uppercase tracking-[0.14em] text-[var(--terminal-muted)]">
          Public wallet ID
        </p>
        <div className="mt-2 flex items-start gap-2">
          <code className="min-w-0 flex-1 break-all rounded-md border border-[var(--terminal-border)] bg-[var(--terminal-bg)] px-3 py-2 font-mono text-[12px]">
            {publicWalletId}
          </code>
          <button
            type="button"
            onClick={() => void copyId()}
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-[var(--terminal-border)] text-[var(--terminal-muted)] hover:text-[var(--terminal-text)]"
            aria-label={copied ? "Copied" : "Copy wallet ID"}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </button>
        </div>
      </div>
      {walletStatus && walletStatus !== "ACTIVE" ? (
        <p className="text-[12px] text-[var(--terminal-muted)]">
          Wallet status: {walletStatus === "FROZEN" ? "Frozen" : "Closed"}
        </p>
      ) : null}
      <p className="text-[12px] leading-relaxed text-[var(--terminal-muted)]">
        This custodial wallet holds crypto balances for this portfolio only. Keys are not
        customer-accessible.
      </p>
    </div>
  );

  if (isNarrow) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className={cn(
            "gap-0 rounded-t-xl border-[var(--terminal-border)] bg-[var(--terminal-surface)] p-0 text-[var(--terminal-text)]",
            "max-h-[min(90dvh,calc(100dvh-1rem))] overflow-hidden",
          )}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            focusDialogCloseButton(event.currentTarget);
          }}
        >
          <SheetHeader className="border-b border-[var(--terminal-border)] px-4 py-3 pr-14 text-left">
            <SheetTitle>Crypto wallet</SheetTitle>
            <SheetDescription className="text-[var(--terminal-muted)]">
              Portfolio custodial wallet
            </SheetDescription>
          </SheetHeader>
          <div className="p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{body}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[var(--terminal-border)] bg-[var(--terminal-surface)] text-[var(--terminal-text)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crypto wallet</DialogTitle>
          <DialogDescription className="text-[var(--terminal-muted)]">
            Portfolio custodial wallet
          </DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
