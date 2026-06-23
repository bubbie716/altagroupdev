/**
 * Alta Internal API — mock service layer for staff operations portal.
 */

export * from "./types";
export { internalPreviewNotice } from "./data";

import {
  bankOpsAccounts,
  bankOpsDepositWithdrawRequests,
  bankOpsLoanApplications,
  bankOpsSummary,
  bankOpsTransfers,
  companyAccounts,
  apiApplications,
  complianceCases,
  exchangeListings,
  exchangeOpsSummary,
  internalSettings,
  internalUsers,
  ipoApplications,
  listingRecords,
  overviewMetrics,
  recentAdminActivity,
  systemStatus,
  terminalActivitySummary,
  terminalOpenOrders,
  terminalTopViewed,
  terminalWatchlistTrends,
} from "./data";

export function getOverviewMetrics() {
  return overviewMetrics;
}

export function getSystemStatus() {
  return systemStatus;
}

export function getRecentAdminActivity() {
  return recentAdminActivity;
}

export function getInternalUsers() {
  return internalUsers;
}

export function getCompanyAccounts() {
  return companyAccounts;
}

export function getCompanyById(id: string) {
  return companyAccounts.find((c) => c.id === id) ?? null;
}

export function getBankOpsSummary() {
  return bankOpsSummary;
}

export function getBankOpsAccounts() {
  return bankOpsAccounts;
}

export function getBankOpsTransfers() {
  return bankOpsTransfers;
}

export function getBankOpsLoanApplications() {
  return bankOpsLoanApplications;
}

export function getBankOpsDepositWithdrawRequests() {
  return bankOpsDepositWithdrawRequests;
}

export function getExchangeOpsSummary() {
  return exchangeOpsSummary;
}

export function getExchangeListings() {
  return exchangeListings;
}

export function getIpoApplications() {
  return ipoApplications;
}

export function getApiApplications() {
  return apiApplications;
}

export function getListingRecords() {
  return listingRecords;
}

export function getTerminalActivitySummary() {
  return terminalActivitySummary;
}

export function getTerminalOpenOrders() {
  return terminalOpenOrders;
}

export function getTerminalTopViewed() {
  return terminalTopViewed;
}

export function getTerminalWatchlistTrends() {
  return terminalWatchlistTrends;
}

export function getComplianceCases() {
  return complianceCases;
}

export function getInternalSettings() {
  return internalSettings;
}

export const internalApi = {
  getOverviewMetrics,
  getSystemStatus,
  getRecentAdminActivity,
  getInternalUsers,
  getCompanyAccounts,
  getCompanyById,
  getBankOpsSummary,
  getBankOpsAccounts,
  getBankOpsTransfers,
  getBankOpsLoanApplications,
  getBankOpsDepositWithdrawRequests,
  getExchangeOpsSummary,
  getExchangeListings,
  getIpoApplications,
  getApiApplications,
  getListingRecords,
  getTerminalActivitySummary,
  getTerminalOpenOrders,
  getTerminalTopViewed,
  getTerminalWatchlistTrends,
  getComplianceCases,
  getInternalSettings,
};
