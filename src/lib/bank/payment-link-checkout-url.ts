/**
 * Stable checkout URL helpers for payment links.
 *
 * Display must stay relative (`/pay/{slug}`) so SSR and the first client
 * render produce identical markup. Absolute URLs are only for copy/share
 * after hydration (or inside click handlers).
 */

export function paymentLinkCheckoutPath(slugOrPath: string): string {
  const trimmed = slugOrPath.trim();
  if (!trimmed) return "/pay/";
  if (trimmed.startsWith("/pay/")) return trimmed;
  if (trimmed.startsWith("/")) return trimmed;
  return `/pay/${trimmed}`;
}

/** Absolute URL for clipboard/share. Prefer calling from a user gesture. */
export function absolutePaymentLinkCheckoutUrl(
  pathOrSlug: string,
  origin: string,
): string {
  const path = paymentLinkCheckoutPath(pathOrSlug);
  const base = origin.replace(/\/$/, "");
  return `${base}${path}`;
}
