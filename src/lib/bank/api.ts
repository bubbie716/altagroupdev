/**
 * Alta Bank API — mock service layer.
 *
 * Future architecture:
 *   Alta Bank UI → Alta Bank API (HTTP) → banking data services
 *
 * Today all functions return in-memory mock data synchronously.
 */

export * from "./types";
export { florin } from "./data";

import {
  adminClients,
  adminLoanQueue,
  adminPrivateQueue,
  bankAccounts,
  bankDashboard,
  bankDescription,
  bankMarketingSections,
  bankRecentActivity,
  businessMetrics,
  businessServices,
  depositProducts,
  lendingProducts,
  privateBanking,
  privateMetrics,
  transferHistory,
} from "./data";

/** GET /v1/bank/description */
export function getBankDescription() {
  return bankDescription;
}

/** GET /v1/bank/dashboard */
export function getBankDashboard() {
  return bankDashboard;
}

/** GET /v1/bank/accounts */
export function getBankAccounts() {
  return bankAccounts;
}

/** GET /v1/bank/deposits */
export function getDepositProducts() {
  return depositProducts;
}

/** GET /v1/bank/lending */
export function getLendingProducts() {
  return lendingProducts;
}

/** GET /v1/bank/transfers */
export function getTransferHistory() {
  return transferHistory;
}

/** GET /v1/bank/private */
export function getPrivateBanking() {
  return privateBanking;
}

/** GET /v1/bank/private/metrics */
export function getPrivateMetrics() {
  return privateMetrics;
}

/** GET /v1/bank/business/metrics */
export function getBusinessMetrics() {
  return businessMetrics;
}

/** GET /v1/bank/business/services */
export function getBusinessServices() {
  return businessServices;
}

/** GET /v1/bank/admin/clients */
export function getAdminClients() {
  return adminClients;
}

/** GET /v1/bank/admin/private-queue */
export function getAdminPrivateQueue() {
  return adminPrivateQueue;
}

/** GET /v1/bank/admin/loan-queue */
export function getAdminLoanQueue() {
  return adminLoanQueue;
}

/** GET /v1/bank/activity/recent */
export function getRecentActivity() {
  return bankRecentActivity;
}

/** GET /v1/bank/marketing */
export function getMarketingSections() {
  return bankMarketingSections;
}

export const bankApi = {
  getBankDescription,
  getBankDashboard,
  getBankAccounts,
  getDepositProducts,
  getLendingProducts,
  getTransferHistory,
  getPrivateBanking,
  getPrivateMetrics,
  getBusinessMetrics,
  getBusinessServices,
  getAdminClients,
  getAdminPrivateQueue,
  getAdminLoanQueue,
  getRecentActivity,
  getMarketingSections,
};
