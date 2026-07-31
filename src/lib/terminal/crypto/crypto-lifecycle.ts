/**
 * Asset and wallet lifecycle gates for fictional Alta crypto trading.
 */

import { CryptoOrderError } from "./crypto-order-types";

export type AssetLifecycleStatus = "DRAFT" | "ACTIVE" | "HALTED" | "REDEMPTION_ONLY" | "CLOSED";
export type WalletLifecycleStatus = "ACTIVE" | "FROZEN" | "CLOSED";

export function assertAssetAllowsSide(
  status: AssetLifecycleStatus,
  side: "BUY" | "SELL",
): void {
  switch (status) {
    case "DRAFT":
      throw new CryptoOrderError(
        "ASSET_DRAFT",
        "This asset is not available for trading yet.",
      );
    case "ACTIVE":
      return;
    case "HALTED":
      throw new CryptoOrderError("ASSET_HALTED", "Trading in this asset is temporarily halted.");
    case "REDEMPTION_ONLY":
      if (side === "BUY") {
        throw new CryptoOrderError(
          "REDEMPTION_ONLY",
          "This asset is redemption-only. New purchases are not allowed.",
        );
      }
      return;
    case "CLOSED":
      throw new CryptoOrderError("ASSET_CLOSED", "This asset is closed and cannot be traded.");
    default: {
      const _exhaustive: never = status;
      void _exhaustive;
      throw new CryptoOrderError("CRYPTO_UNAVAILABLE", "Alta crypto trading is not available right now.");
    }
  }
}

export function assertWalletCanTrade(status: WalletLifecycleStatus | null | undefined): void {
  if (status == null) return; // no wallet yet — buys may create; sells rejected elsewhere
  if (status === "ACTIVE") return;
  if (status === "FROZEN") {
    throw new CryptoOrderError("WALLET_FROZEN", "This crypto wallet is frozen and cannot trade.");
  }
  throw new CryptoOrderError("WALLET_CLOSED", "This crypto wallet is closed and cannot trade.");
}
