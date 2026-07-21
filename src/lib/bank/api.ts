/**
 * Alta Bank API — mock service layer.
 *
 * Marketing and dashboard mock routes still read from in-memory data.
 * Live banking flows use server functions and Prisma-backed services.
 */

export * from "./types";
export { florin } from "@/lib/format/money-display";

import {
  bankAccounts,
  bankDashboard,
  bankProducts,
  bankRecentActivity,
  lendingProducts,
} from "./data";

/** GET /v1/bank/dashboard */
export function getBankDashboard() {
  return bankDashboard;
}

/** GET /v1/bank/accounts */
export function getBankAccounts() {
  return bankAccounts;
}

/** GET /v1/bank/products */
export function getBankProducts() {
  return bankProducts;
}

/** GET /v1/bank/lending */
export function getLendingProducts() {
  return lendingProducts;
}

/** GET /v1/bank/activity/recent */
export function getRecentActivity() {
  return bankRecentActivity;
}
