import type { ExchangeIndex } from "./types";

/** GET /v1/indices */
export function getIndices(): ExchangeIndex[] {
  return [];
}

/** GET /v1/indices/:symbol */
export function getIndex(_symbol: string): ExchangeIndex | null {
  return null;
}
