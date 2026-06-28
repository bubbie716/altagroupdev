import type { ReactNode } from "react";
import { InternalShellProvider } from "@/components/internal/console/internal-shell-context";
import { InternalSidebar } from "@/components/internal/console/internal-sidebar";
import { InternalHeader } from "@/components/internal/console/internal-header";

export function InternalShell({ children }: { children: ReactNode }) {
  return (
    <InternalShellProvider>
      <div className="internal-shell flex h-dvh overflow-hidden bg-background text-foreground">
        <InternalSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <InternalHeader />
          <main className="internal-main min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <div className="internal-console-content mx-auto w-full max-w-[1600px] px-4 py-3 sm:px-5 sm:py-4">
              {children}
            </div>
          </main>
        </div>
      </div>
    </InternalShellProvider>
  );
}
