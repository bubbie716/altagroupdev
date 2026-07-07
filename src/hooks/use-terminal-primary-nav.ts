import { useMemo } from "react";
import { buildTerminalPrimaryNavLinks } from "@/lib/terminal/terminal-primary-nav";
import type { SiteNavLink } from "@/config/sites";

export function useTerminalPrimaryNavLinks(): SiteNavLink[] {
  return useMemo(() => buildTerminalPrimaryNavLinks(), []);
}
