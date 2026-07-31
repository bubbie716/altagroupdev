"use client";

import * as React from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";

import { OVERLAY_SCRIM_CLASS } from "@/lib/ui/overlay-layers";
import { useOverlayScrollGuard } from "@/lib/ui/overlay-scroll-guard";
import { cn } from "@/lib/utils";

/**
 * Non-modal by default: matches Dialog — no body scroll lock / RemoveScroll
 * jump-to-top when opening or closing sheets site-wide.
 */
const Sheet = ({
  modal = false,
  ...props
}: React.ComponentPropsWithoutRef<typeof SheetPrimitive.Root>) => (
  <SheetPrimitive.Root modal={modal} {...props} />
);

const SheetTrigger = SheetPrimitive.Trigger;

const SheetClose = SheetPrimitive.Close;

const SheetPortal = SheetPrimitive.Portal;

/** Above sticky UI Lab banner (z-9999) so sheet chrome is not covered; top offset clears the banner. */
const SHEET_Z = "z-[10050]";

function scrollPageBehindOverlay(deltaX: number, deltaY: number) {
  if (deltaX === 0 && deltaY === 0) return;
  window.scrollBy({ left: deltaX, top: deltaY, behavior: "instant" });
}

/**
 * Plain backdrop (Radix Overlay is omitted when modal=false). Captures pointer
 * hits so controls behind stay inert, and forwards wheel/touch to the page.
 */
const SheetOverlay = React.forwardRef<
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
        "fixed inset-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        SHEET_Z,
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
SheetOverlay.displayName = "SheetOverlay";

const sheetVariants = cva(
  cn(
    "fixed gap-4 bg-surface-1 p-6 shadow-lg transition ease-in-out",
    "data-[state=closed]:duration-300 data-[state=open]:duration-500 data-[state=open]:animate-in data-[state=closed]:animate-out",
    SHEET_Z,
  ),
  {
    variants: {
      side: {
        top: "inset-x-0 top-[var(--ui-lab-banner-height,0px)] max-h-[var(--internal-sheet-available-height,100dvh)] overflow-y-auto border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom:
          "inset-x-0 bottom-0 max-h-[var(--internal-sheet-available-height,100dvh)] overflow-y-auto border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom pb-[env(safe-area-inset-bottom,0px)]",
        left: "top-[var(--ui-lab-banner-height,0px)] bottom-0 left-0 flex h-[var(--internal-sheet-available-height,100dvh)] max-h-[var(--internal-sheet-available-height,100dvh)] w-[min(100%,24rem)] max-w-[100vw] flex-col overflow-hidden border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right:
          "top-[var(--ui-lab-banner-height,0px)] bottom-0 right-0 flex h-[var(--internal-sheet-available-height,100dvh)] max-h-[var(--internal-sheet-available-height,100dvh)] w-[min(100%,24rem)] max-w-[100vw] flex-col overflow-hidden border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

interface SheetContentProps
  extends
    React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  overlayClassName?: string;
  /** Hide the built-in close control when the consumer provides its own. */
  hideCloseButton?: boolean;
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(
  (
    {
      side = "right",
      className,
      overlayClassName,
      hideCloseButton = false,
      children,
      onOpenAutoFocus,
      onCloseAutoFocus,
      ...props
    },
    ref,
  ) => {
    const { handleOpenAutoFocus, handleCloseAutoFocus } = useOverlayScrollGuard(
      onOpenAutoFocus,
      onCloseAutoFocus,
    );

    return (
      <SheetPortal>
        <SheetOverlay className={overlayClassName} />
        <SheetPrimitive.Content
          ref={ref}
          className={cn(sheetVariants({ side }), className)}
          onOpenAutoFocus={handleOpenAutoFocus}
          onCloseAutoFocus={handleCloseAutoFocus}
          {...props}
        >
          {hideCloseButton ? null : (
            <SheetPrimitive.Close
              data-dialog-close=""
              className={cn(
                "absolute right-2 top-2 inline-flex size-11 items-center justify-center rounded-md",
                "opacity-80 ring-offset-background transition-opacity hover:opacity-100",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "disabled:pointer-events-none data-[state=open]:bg-secondary",
              )}
            >
              <X className="size-4 shrink-0" aria-hidden />
              <span className="sr-only">Close</span>
            </SheetPrimitive.Close>
          )}
          {children}
        </SheetPrimitive.Content>
      </SheetPortal>
    );
  },
);
SheetContent.displayName = SheetPrimitive.Content.displayName;

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
SheetHeader.displayName = "SheetHeader";

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
SheetFooter.displayName = "SheetFooter";

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold text-foreground", className)}
    {...props}
  />
));
SheetTitle.displayName = SheetPrimitive.Title.displayName;

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
SheetDescription.displayName = SheetPrimitive.Description.displayName;

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
