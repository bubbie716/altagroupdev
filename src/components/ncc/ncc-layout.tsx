import type { ReactNode } from "react";

import { NccCopyrightFooter, NccFooter } from "@/components/ncc/ncc-footer";
import { NccNav } from "@/components/ncc/ncc-nav";

/** Institutional shell for all NCC pages — separate from Alta Group branding. */
export function NccLayout({
  children,
  footer = "full",
}: {
  children: ReactNode;
  /** Auth pages use copyright-only footer. */
  footer?: "full" | "copyright";
}) {
  return (
    <div className="ncc-site flex min-h-screen flex-col bg-white font-sans text-[#111827] antialiased">
      <NccNav />
      <div className="flex flex-1 flex-col">{children}</div>
      {footer === "copyright" ? <NccCopyrightFooter /> : <NccFooter />}
    </div>
  );
}
