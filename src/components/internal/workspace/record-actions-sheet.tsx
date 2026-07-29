"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const RecordActionsCloseCtx = createContext<(afterClose?: () => void) => void>(() => {});

/** Close the Actions sheet before navigating so overlays do not linger. */
export function useRecordActionsClose() {
  return useContext(RecordActionsCloseCtx);
}

/**
 * Permission-aware Actions entry point for record workspaces.
 * Renders a full-height sheet on mobile with sticky footer slot.
 */
export function RecordActionsSheet({
  title = "Actions",
  description = "Choose an action for this record.",
  children,
  footer,
  triggerLabel = "Actions",
  disabled = false,
  className,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  triggerLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const closeThen = useCallback((afterClose?: () => void) => {
    setOpen(false);
    if (!afterClose) return;
    window.setTimeout(() => afterClose(), 0);
  }, []);

  return (
    <RecordActionsCloseCtx.Provider value={closeThen}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded border border-border bg-surface-1 px-3 text-[12px] font-medium text-foreground hover:border-border-strong disabled:opacity-40",
          className,
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {triggerLabel}
        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-[min(100%,28rem)] max-w-[100vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
          hideCloseButton={false}
        >
          <SheetHeader className="shrink-0 border-b border-border/60 px-4 py-3 pr-12 text-left">
            <SheetTitle className="text-left text-[15px]">{title}</SheetTitle>
            <SheetDescription className="text-left text-[12px]">{description}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <div className="space-y-3" data-record-actions>
              {children}
            </div>
          </div>
          {footer ? (
            <div className="sticky bottom-0 shrink-0 border-t border-border/60 bg-surface-1 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </RecordActionsCloseCtx.Provider>
  );
}

export function RecordActionGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h4 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

/** Action that jumps within the record — closes sheet first. */
export function RecordActionNavButton({
  label,
  onNavigate,
}: {
  label: string;
  onNavigate: () => void;
}) {
  const closeThen = useRecordActionsClose();
  return (
    <button
      type="button"
      onClick={() => closeThen(onNavigate)}
      className="rounded border border-border px-2.5 py-1.5 text-left text-[12px] hover:border-border-strong"
    >
      {label}
    </button>
  );
}
