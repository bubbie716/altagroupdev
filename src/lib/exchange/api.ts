/**
 * Market data stubs used by Terminal and tests.
 *
 * Returns empty / unavailable datasets. Alta does not operate an exchange;
 * external exchange connectivity is not integrated yet. Never fabricates
 * listings, prices, or indices.
 */

export * from "./types";
export { getCompanies, getCompany } from "./companies";
export { getIndices, getIndex } from "./indices";
export { getIPOs } from "./ipos";
export { getFilings, getCorporateActions } from "./filings";
export { getMarketStats } from "./market-stats";
export { getAnnouncements } from "./announcements";

import { getCompany, getCompanies } from "./companies";
import { getCorporateActions, getFilings } from "./filings";
import { getIndex, getIndices } from "./indices";
import { getIPOs } from "./ipos";
import { getMarketStats } from "./market-stats";
import { getAnnouncements } from "./announcements";

/** Single-object facade for consumers that prefer one import. */
export const exchangeApi = {
  getCompanies,
  getCompany,
  getIndices,
  getIndex,
  getIPOs,
  getFilings,
  getCorporateActions,
  getMarketStats,
  getAnnouncements,
};
