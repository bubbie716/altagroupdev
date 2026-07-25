"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import type { BankActionFlowController } from "@/components/bank/actions/bank-action-flow-types";
import type { BankActionPhase } from "@/lib/bank/bank-action-flow";
import { cn } from "@/lib/utils";

/**
 * Page-shell host for the same flow components used in overlays.
 * Keeps sticky footer behavior on mobile without a dialog.
 */
export function BankActionPageSurface({
  initialPhase = "details",
  className,
  children,
}: {
  initialPhase?: BankActionPhase;
  className?: string;
  children: (ctrl: BankActionFlowController) => ReactNode;
}) {
  const [phase, setPhase] = useState<BankActionPhase>(initialPhase);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState<string | undefined>();
  const [dirty, setDirty] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const [footer, setFooter] = useState<ReactNode>(null);
  const backRef = useRef<(() => void) | null>(null);

  const registerBack = useCallback((fn: (() => void) | null) => {
    backRef.current = fn;
  }, []);

  const ctrl: BankActionFlowController = {
    phase,
    setPhase,
    setTitle,
    setDescription,
    setDirty,
    setShowBack,
    setFooter,
    registerBack,
    onDone: () => {
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      setPhase(initialPhase);
    },
  };

  void dirty;

  return (
    <div className={cn("mx-auto w-full max-w-lg", className)}>
      <div className="mb-4 flex items-start gap-2">
        {showBack ? (
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-[var(--menu-item-hover)]"
            aria-label="Back"
            onClick={() => backRef.current?.()}
          >
            ←
          </button>
        ) : null}
        <div className="min-w-0">
          {title ? <h2 className="text-[18px] font-semibold tracking-tight">{title}</h2> : null}
          {description ? (
            <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="pb-24 md:pb-8">{children(ctrl)}</div>
      {footer ? (
        <div className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] z-10 border-t border-border bg-background/95 px-0 py-3 backdrop-blur md:static md:border-0 md:bg-transparent md:backdrop-blur-none">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
