/** Alta Terminal — brokerage product title (no marketing slogans in-app) */
export const ALTA_TERMINAL_TAGLINE = "Alta Terminal";

/** Alta Terminal — product positioning (not an exchange operator) */
export const ALTA_TERMINAL_SUBTITLE = "Alta’s brokerage and trading platform";

export const ALTA_TERMINAL_EYEBROW = "Alta Terminal";

export function terminalPageDescription(detail: string): string {
  return `${ALTA_TERMINAL_SUBTITLE}. ${detail}`;
}
