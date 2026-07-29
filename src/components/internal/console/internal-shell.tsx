import type { ReactNode } from "react";
import { InternalShellProvider } from "@/components/internal/console/internal-shell-context";
import { InternalSidebar } from "@/components/internal/console/internal-sidebar";
import { InternalHeader } from "@/components/internal/console/internal-header";
import { InternalMobileNav } from "@/components/internal/console/internal-mobile-nav";
import { InternalContextualNav } from "@/components/internal/console/internal-contextual-nav";

/**
 * Header title is derived from the current pathname (SSR/client identical) and
 * refined by InternalPageShell after paint. Flex order keeps chrome visually first.
 */
export function InternalShell({ children }: { children: ReactNode }) {
  return (
    <InternalShellProvider>
      <div className="internal-shell flex h-dvh overflow-hidden bg-background text-foreground">
        <InternalSidebar />
        <InternalMobileNav />
        <div className="flex min-w-0 flex-1 flex-col">
          <InternalHeader />
          <InternalContextualNav />
          <main className="internal-main order-3 min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="internal-console-content mx-auto w-full max-w-[1600px] px-4 py-3 sm:px-5 sm:py-4">
              {children}
            </div>
          </main>
        </div>
      </div>
    </InternalShellProvider>
  );
}
