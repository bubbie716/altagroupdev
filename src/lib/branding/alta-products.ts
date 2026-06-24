/** Alta Exchange — division tagline */
export const ALTA_EXCHANGE_TAGLINE = "The capital markets platform of Newport.";

/** Alta Terminal — product tagline (title) */
export const ALTA_TERMINAL_TAGLINE = "Invest Like The 1%";

/** Alta Terminal — product positioning */
export const ALTA_TERMINAL_SUBTITLE = "An Alta Exchange Product";

export const ALTA_TERMINAL_EYEBROW = "Alta Exchange · Terminal";

export function terminalPageDescription(detail: string): string {
  return `${ALTA_TERMINAL_SUBTITLE}. ${detail}`;
}
