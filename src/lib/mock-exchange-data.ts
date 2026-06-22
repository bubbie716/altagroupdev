/**
 * @deprecated Import from `@/lib/exchange/api` instead.
 * Retained for backward compatibility during migration.
 */
import { compact, florin, pct } from "./mock-data";
import {
  getCompanies,
  getCompany,
  getCorporateActions,
  getFilings,
  getIndex,
  getIndices,
  getIPOs,
  getMarketStats,
} from "./exchange/api";

export { compact, florin, pct };
export * from "./exchange/types";

const market = getMarketStats();

/** @deprecated Use getMarketStats().description */
export const exchangeDescription = market.description;

/** @deprecated Use getMarketStats().stats */
export const exchangeStats = market.stats;

/** @deprecated Use getCompanies() */
export const listedCompanies = getCompanies();

/** @deprecated Use getCompany() */
export const getCompanyProfile = getCompany;

/** @deprecated Use getIndices() */
export const exchangeIndices = getIndices();

/** @deprecated Use getIPOs() */
export const ipoListings = getIPOs();

/** @deprecated Use getCorporateActions() */
export const corporateActions = getCorporateActions();

/** @deprecated Use getFilings() */
export const researchDocuments = getFilings();

/** @deprecated Use getMarketStats().rankings */
export const marketRankings = market.rankings;

/** @deprecated Use getMarketStats().snapshot */
export const marketSnapshot = market.snapshot;

/** @deprecated Use getIndex() */
export { getIndex };
