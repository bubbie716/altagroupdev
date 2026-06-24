import type { ReactNode } from "react";
import { PageShell } from "@/components/page-shell";
import { MockDataNotice } from "@/components/data/mock-data-notice";
import { TerminalSubNav } from "@/components/terminal/terminal-sub-nav";
import { isPublicSimulatedMarketDataEnabled } from "@/lib/config/data-mode";
import {
  ALTA_TERMINAL_EYEBROW,
  ALTA_TERMINAL_TAGLINE,
  terminalPageDescription,
} from "@/lib/branding/alta-products";

export function TerminalLayoutNav() {
  return (
    <>
      {isPublicSimulatedMarketDataEnabled() && <MockDataNotice className="mb-4" />}
      <TerminalSubNav />
    </>
  );
}

export function TerminalPageShell({
  title = ALTA_TERMINAL_TAGLINE,
  description,
  children,
}: {
  title?: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <PageShell eyebrow={ALTA_TERMINAL_EYEBROW} title={title} description={terminalPageDescription(description)}>
      <TerminalLayoutNav />
      {children}
    </PageShell>
  );
}

export { ALTA_TERMINAL_TAGLINE, terminalPageDescription };
