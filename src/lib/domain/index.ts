export {
  developmentDomains,
  getDomainHosts,
  getMainHostVariants,
  isLocalDevHostname,
  isMainHost,
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
  getProductNavUrl,
  getTerminalUrl,
  isOnProductSubdomain,
  useAbsoluteProductNav,
} from "./urls";

export { resolveSubdomainRedirect, getSubdomainRootRedirect, type SubdomainRedirect } from "./redirect";
