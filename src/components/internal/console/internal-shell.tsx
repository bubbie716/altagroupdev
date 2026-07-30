import type { ReactNode } from "react";
import { InternalShellProvider } from "@/components/internal/console/internal-shell-context";
import { InternalSidebar } from "@/components/internal/console/internal-sidebar";
import { InternalHeader } from "@/components/internal/console/internal-header";
import { InternalMobileNav } from "@/components/internal/console/internal-mobile-nav";
import { InternalContextualNav } from "@/components/internal/console/internal-contextual-nav";

/**
 * Header title is derived from the current pathname (SSR/client identical) and
 * refined by InternalPageShell after paint. Flex order keeps chrome visually first.
 *
 * Scrolling architecture: the shell is viewport-bounded (minus UI Lab banner).
 * The inner column uses min-h-0 so `<main.internal-main>` is the sole vertical
 * scroll container — header and contextual nav stay pinned.
 */
export function InternalShell({ children }: { children: ReactNode }) {
  return (
    <InternalShellProvider>
      <div className="internal-shell flex overflow-hidden bg-background text-foreground">
        <InternalSidebar />
        <InternalMobileNav />
        <div className="internal-shell-column">
          <InternalHeader />
          <InternalContextualNav />
          <main className="internal-main order-3">
            <div className="internal-console-content mx-auto w-full max-w-[1600px] px-4 py-3 sm:px-5 sm:py-4">
              {children}
            </div>
          </main>
        </div>
      </div>
    </InternalShellProvider>
  );
}
