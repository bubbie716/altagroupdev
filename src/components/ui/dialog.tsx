"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { OVERLAY_SCRIM_CLASS } from "@/lib/ui/overlay-layers";
import { cn } from "@/lib/utils";

/**
 * Non-modal by default: no body scroll lock / RemoveScroll jump-to-top.
 * Backdrop is a plain div (Radix Overlay is omitted when modal=false). It
 * captures pointer hits so controls behind stay inert, and forwards
 * wheel/touch so the page can keep scrolling under the scrim.
 */
const Dialog = ({
  modal = false,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>) => (
  <DialogPrimitive.Root modal={modal} {...props} />
);

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

function scrollPageBehindOverlay(deltaX: number, deltaY: number) {
  if (deltaX === 0 && deltaY === 0) return;
  window.scrollBy({ left: deltaX, top: deltaY, behavior: "instant" });
}

const DialogOverlay = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, onWheel, onTouchStart, onTouchMove, ...props }, ref) => {
  const lastTouchRef = React.useRef<{ x: number; y: number } | null>(null);

  return (
    <div
      ref={ref}
      aria-hidden
      data-state="open"
      className={cn(
        "fixed inset-0 z-[110]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        OVERLAY_SCRIM_CLASS,
        className,
      )}
      onWheel={(event) => {
        onWheel?.(event);
        if (event.defaultPrevented) return;
        scrollPageBehindOverlay(event.deltaX, event.deltaY);
      }}
      onTouchStart={(event) => {
        onTouchStart?.(event);
        if (event.defaultPrevented) return;
        const touch = event.touches[0];
        if (!touch) return;
        lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchMove={(event) => {
        onTouchMove?.(event);
        if (event.defaultPrevented) return;
        const touch = event.touches[0];
        const last = lastTouchRef.current;
        if (!touch || !last) return;
        scrollPageBehindOverlay(last.x - touch.clientX, last.y - touch.clientY);
        lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
      }}
      {...props}
    />
  );
});
DialogOverlay.displayName = "DialogOverlay";

interface DialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  overlayClassName?: string;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, overlayClassName, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay className={overlayClassName} />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "pointer-events-auto fixed left-[50%] top-[50%] z-[110] grid w-[calc(100%-2rem)] max-w-lg max-h-[min(90dvh,calc(100dvh-4rem))] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto overscroll-contain border border-border bg-surface-1 p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        data-dialog-close=""
        className={cn(
          "absolute right-2 top-2 inline-flex size-11 items-center justify-center rounded-md",
          "opacity-80 ring-offset-background transition-opacity hover:opacity-100",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground",
        )}
      >
        <X className="size-4 shrink-0" aria-hidden />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
