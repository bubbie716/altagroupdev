import { createServerFn } from "@tanstack/react-start";

/** @deprecated Prefer terminal.functions + getTseClient. Kept for incidental imports. */
export { florin, compact, pct } from "@/lib/format/money-display";
export { terminalPageDescription as terminalDescription } from "@/lib/branding/alta-products";

export const getTerminalDescription = createServerFn({ method: "GET" }).handler(async () => {
  const { terminalPageDescription } = await import("@/lib/branding/alta-products");
  return terminalPageDescription("Brokerage workspace for Newport investors.");
});
