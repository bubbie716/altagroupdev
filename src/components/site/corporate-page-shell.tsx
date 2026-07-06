import type { ReactNode } from "react";
import { SiteNav } from "@/components/site-nav";

export function CorporatePageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-background">
      <SiteNav />
      <div className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col px-6 pt-14 pb-24">
        {children}
      </div>
    </div>
  );
}
