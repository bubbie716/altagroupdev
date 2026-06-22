export {
  developmentDomains,
  getDomainHosts,
  isLocalDevHostname,
  productHomePaths,
  productionDomains,
  type ProductDomain,
} from "./config";

export {
  getCurrentSubdomain,
  getHostname,
  getProductHomePath,
  isBankDomain,
  isExchangeDomain,
  isMainDomain,
  isTerminalDomain,
} from "./host";

export {
  getBankUrl,
  getExchangeUrl,
  getMainSiteUrl,
  getTerminalUrl,
  isOnProductSubdomain,
} from "./urls";

export { getSubdomainRootRedirect } from "./redirect";
