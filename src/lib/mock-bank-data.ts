/**
 * @deprecated Import from `@/lib/bank/api` instead.
 */
export {
  florin,
  getAdminClients,
  getAdminLoanQueue,
  getAdminPrivateQueue,
  getBankAccounts,
  getBankDashboard,
  getBankDescription,
  getBusinessMetrics,
  getBusinessServices,
  getDepositProducts,
  getLendingProducts,
  getMarketingSections,
  getPrivateBanking,
  getPrivateMetrics,
  getRecentActivity,
  getTransferHistory,
} from "./bank/api";

export * from "./bank/types";

import {
  getAdminClients,
  getAdminLoanQueue,
  getAdminPrivateQueue,
  getBankAccounts,
  getBankDashboard,
  getBankDescription,
  getBusinessMetrics,
  getBusinessServices,
  getDepositProducts,
  getLendingProducts,
  getMarketingSections,
  getPrivateBanking,
  getPrivateMetrics,
  getRecentActivity,
  getTransferHistory,
} from "./bank/api";

/** @deprecated Use getBankDescription() */
export const bankDescription = getBankDescription();

/** @deprecated Use getBankDashboard() */
export const bankDashboard = getBankDashboard();

/** @deprecated Use getBankAccounts() */
export const bankAccounts = getBankAccounts();

/** @deprecated Use getDepositProducts() */
export const depositProducts = getDepositProducts();

/** @deprecated Use getLendingProducts() */
export const lendingProducts = getLendingProducts();

/** @deprecated Use getTransferHistory() */
export const transferHistory = getTransferHistory();

/** @deprecated Use getPrivateBanking() */
export const privateBanking = getPrivateBanking();

/** @deprecated Use getPrivateMetrics() */
export const privateMetrics = getPrivateMetrics();

/** @deprecated Use getBusinessMetrics() */
export const businessMetrics = getBusinessMetrics();

/** @deprecated Use getBusinessServices() */
export const businessServices = getBusinessServices();

/** @deprecated Use getAdminClients() */
export const adminClients = getAdminClients();

/** @deprecated Use getAdminPrivateQueue() */
export const adminPrivateQueue = getAdminPrivateQueue();

/** @deprecated Use getAdminLoanQueue() */
export const adminLoanQueue = getAdminLoanQueue();

/** @deprecated Use getRecentActivity() */
export const bankRecentActivity = getRecentActivity();

/** @deprecated Use getMarketingSections() */
export const bankMarketingSections = getMarketingSections();
