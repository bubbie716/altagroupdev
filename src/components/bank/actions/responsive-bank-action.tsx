"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { canDismissBankAction, type BankActionPhase } from "@/lib/bank/bank-action-flow";
import { closeThenRun } from "@/lib/ui/close-then-run";
import { focusDialogCloseButton } from "@/lib/ui/focus-dialog-close";
import {
  hasOpenNestedOverlay,
  isNestedOverlayElement,
  overlayZClass,
} from "@/lib/ui/overlay-layers";
import { registerTransientOverlay } from "@/lib/ui/transient-overlay-registry";
import { cn } from "@/lib/utils";

const CLOSE_RESET_MS = 320;

/**
 * One responsive tree: centered dialog on desktop, bottom sheet on mobile
 * (SSR-safe CSS — no matchMedia branch / dual form mounts).
 */
export function ResponsiveBankAction({
  open,
  onOpenChange,
  title,
  description,
  phase,
  dirty = false,
  size = "md",
  children,
  footer,
  onBack,
  showBack = false,
  onCloseAutoFocus,
  contentClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  phase: BankActionPhase;
  /** When true, closing prompts for unsaved work confirmation. */
  dirty?: boolean;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  footer?: ReactNode;
  onBack?: () => void;
  showBack?: boolean;
  onCloseAutoFocus?: () => void;
  contentClassName?: string;
}) {
  const dismissible = canDismissBankAction(phase);
  const [confirmClose, setConfirmClose] = useState(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentKeyRef = useRef(0);
  const [mountedContent, setMountedContent] = useState(open);

  useEffect(() => {
    if (!open) return;
    return registerTransientOverlay(() => {
      if (dismissible) onOpenChange(false);
    });
  }, [open, dismissible, onOpenChange]);

  useEffect(() => {
    if (open) {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
      contentKeyRef.current += 1;
      setMountedContent(true);
      setConfirmClose(false);
      return;
    }
    // Reset form state only after close animation completes.
    resetTimerRef.current = setTimeout(() => {
      setMountedContent(false);
      setConfirmClose(false);
    }, CLOSE_RESET_MS);
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, [open]);

  function requestClose() {
    if (!dismissible) return;
    if (dirty && phase !== "success" && !confirmClose) {
      setConfirmClose(true);
      return;
    }
    closeThenRun(() => onOpenChange(false), () => onCloseAutoFocus?.());
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      onOpenChange(true);
      return;
    }
    requestClose();
  }

  const maxWidth =
    size === "sm" ? "sm:max-w-md" : size === "lg" ? "sm:max-w-xl" : "sm:max-w-lg";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        overlayClassName={cn(
          overlayZClass("bankAction"),
          "bg-black/80 data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0",
          "motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none",
        )}
        className={cn(
          overlayZClass("bankAction"),
          "flex flex-col gap-0 overflow-hidden border-border bg-surface-1 p-0 text-foreground",
          "data-[state=closed]:pointer-events-none",
          "motion-reduce:data-[state=open]:animate-none motion-reduce:data-[state=closed]:animate-none",
          maxWidth,
          // Mobile bottom sheet above Bank mobile nav + safe area
          "max-md:left-0 max-md:right-0 max-md:top-auto max-md:bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] max-md:max-h-[min(88dvh,calc(100dvh-5.5rem))] max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-t-2xl max-md:rounded-b-none",
          "md:max-h-[min(90dvh,calc(100dvh-4rem))]",
          contentClassName,
        )}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          focusDialogCloseButton(event.currentTarget);
        }}
        onEscapeKeyDown={(event) => {
          // Nested Select/Dropdown/Popover owns Escape first.
          if (hasOpenNestedOverlay()) {
            event.preventDefault();
            return;
          }
          if (!dismissible) {
            event.preventDefault();
            return;
          }
          if (confirmClose) {
            event.preventDefault();
            setConfirmClose(false);
            return;
          }
          if (showBack && onBack && phase !== "success" && phase !== "selection") {
            event.preventDefault();
            onBack();
          }
        }}
        onPointerDownOutside={(event) => {
          if (!dismissible || isNestedOverlayElement(event.target)) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          if (!dismissible || isNestedOverlayElement(event.target)) {
            event.preventDefault();
          }
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseAutoFocus?.();
        }}
      >
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pr-14 text-left sm:px-5 sm:py-4">
          <div className="flex items-start gap-2">
            {showBack && onBack && phase !== "success" && phase !== "submitting" ? (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-[13px] font-medium text-muted-foreground hover:bg-[var(--menu-item-hover)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Back"
              >
                ←
              </button>
            ) : null}
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-[16px] font-semibold tracking-tight">{title}</DialogTitle>
              {description ? (
                <DialogDescription className="mt-1 text-[13px] text-muted-foreground">
                  {description}
                </DialogDescription>
              ) : (
                <DialogDescription className="sr-only">
                  {title}. Complete the steps, then confirm.
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        {confirmClose ? (
          <div className="space-y-4 p-4 sm:p-5" role="alertdialog" aria-label="Discard changes">
            <p className="text-[14px] text-foreground">
              Discard this draft? Your entered details will be lost.
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-md border border-border px-4 text-[13px] font-medium hover:bg-[var(--menu-item-hover)]"
                onClick={() => setConfirmClose(false)}
              >
                Keep editing
              </button>
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-md bg-foreground px-4 text-[13px] font-medium text-background"
                onClick={() => {
                  setConfirmClose(false);
                  closeThenRun(() => onOpenChange(false), () => onCloseAutoFocus?.());
                }}
              >
                Discard
              </button>
            </div>
          </div>
        ) : mountedContent ? (
          <>
            <div
              key={contentKeyRef.current}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5"
            >
              {children}
            </div>
            {footer ? (
              <div className="shrink-0 border-t border-border bg-surface-1 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:px-5">
                {footer}
              </div>
            ) : null}
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
