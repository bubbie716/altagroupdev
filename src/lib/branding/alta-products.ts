/** Alta Terminal — brokerage product tagline (title) */
export const ALTA_TERMINAL_TAGLINE = "Invest Like The 1%";

/** Alta Terminal — product positioning (not an exchange operator) */
export const ALTA_TERMINAL_SUBTITLE = "Alta’s brokerage and trading platform";

export const ALTA_TERMINAL_EYEBROW = "Alta Terminal";

/**
 * @deprecated Sprint 4G — Alta Exchange is discontinued. Kept only for historical
 * import compatibility; do not use in active product copy.
 */
export const ALTA_EXCHANGE_TAGLINE = "Discontinued capital markets product.";

export function terminalPageDescription(detail: string): string {
  return `${ALTA_TERMINAL_SUBTITLE}. ${detail}`;
}
