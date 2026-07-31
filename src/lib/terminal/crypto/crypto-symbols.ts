/**
 * Browser-safe crypto symbol helpers — no Prisma / Decimal / Node deps.
 * Keep launch-symbol identity here so client UI can import without pulling
 * server crypto math into the browser bundle.
 */

export type CryptoAssetSymbol = "NPFC" | "NVA" | "VLT";

export const LAUNCH_ASSET_SYMBOLS: readonly CryptoAssetSymbol[] = [
  "NPFC",
  "NVA",
  "VLT",
] as const;

/** Display quantity precision for launch assets (matches seed configs). */
export const CRYPTO_QUANTITY_DISPLAY_PRECISION: Record<CryptoAssetSymbol, number> = {
  NPFC: 8,
  NVA: 8,
  VLT: 8,
};

export function isTerminalCryptoSymbol(symbol: string): boolean {
  const upper = symbol.trim().toUpperCase();
  return (LAUNCH_ASSET_SYMBOLS as readonly string[]).includes(upper);
}

export function asCryptoAssetSymbol(symbol: string): CryptoAssetSymbol | null {
  const upper = symbol.trim().toUpperCase();
  return isTerminalCryptoSymbol(upper) ? (upper as CryptoAssetSymbol) : null;
}
