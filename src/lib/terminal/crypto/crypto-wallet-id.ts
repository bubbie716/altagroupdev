/**
 * Opaque public wallet IDs for custodial Alta crypto ledger wallets.
 * Never embeds username, company name, portfolio id, or sequential database information.
 */

import { randomBytes } from "node:crypto";

const PUBLIC_WALLET_ID_PREFIX = "acw_";
const PUBLIC_WALLET_ID_BYTES = 16;

/** Format: acw_ + 32 lowercase hex chars (128 bits of entropy). */
export function generateTerminalCryptoPublicWalletId(
  random: () => Buffer = () => randomBytes(PUBLIC_WALLET_ID_BYTES),
): string {
  const bytes = random();
  if (bytes.length < PUBLIC_WALLET_ID_BYTES) {
    throw new Error("crypto wallet id entropy too short");
  }
  return `${PUBLIC_WALLET_ID_PREFIX}${bytes.subarray(0, PUBLIC_WALLET_ID_BYTES).toString("hex")}`;
}

export function isTerminalCryptoPublicWalletId(value: string): boolean {
  return /^acw_[0-9a-f]{32}$/.test(value);
}
