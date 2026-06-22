export type ApiEndpoint = {
  method: "GET";
  path: string;
  summary: string;
  mockFn: string;
  params?: string;
  response: string;
};

export const exchangeApiBaseUrl = "https://api.alta.exchange/v1";

export const exchangeApiEndpoints: ApiEndpoint[] = [
  {
    method: "GET",
    path: "/companies",
    summary: "List all issuers currently listed on Alta Exchange.",
    mockFn: "getCompanies()",
    response: "ListedCompany[]",
  },
  {
    method: "GET",
    path: "/companies/:ticker",
    summary: "Retrieve a full company profile including filings, stats, and price history.",
    mockFn: "getCompany(ticker)",
    params: "ticker — symbol (e.g. NPC, ALTB)",
    response: "CompanyProfile | null",
  },
  {
    method: "GET",
    path: "/indices",
    summary: "List all NSX benchmark indices published by Alta Exchange.",
    mockFn: "getIndices()",
    response: "ExchangeIndex[]",
  },
  {
    method: "GET",
    path: "/indices/:symbol",
    summary: "Retrieve a single index with constituents count and time series.",
    mockFn: "getIndex(symbol)",
    params: "symbol — index code (e.g. NSX-100)",
    response: "ExchangeIndex | null",
  },
  {
    method: "GET",
    path: "/ipos",
    summary: "List IPO offerings — open subscriptions, upcoming bookbuilds, and recent listings.",
    mockFn: "getIPOs(stage?)",
    params: "stage — open | upcoming | recent (optional)",
    response: "IPOListing[]",
  },
  {
    method: "GET",
    path: "/filings",
    summary: "Research library — commentary, issuer filings, prospectuses, and exchange notices.",
    mockFn: "getFilings(section?)",
    params: "section — commentary | filings | prospectuses | economic | notices (optional)",
    response: "ResearchDocument[]",
  },
  {
    method: "GET",
    path: "/corporate-actions",
    summary: "Corporate actions across listed issuers — dividends, splits, buybacks, mergers, tenders.",
    mockFn: "getCorporateActions()",
    response: "CorporateAction[]",
  },
  {
    method: "GET",
    path: "/market/stats",
    summary: "Exchange-wide statistics, live session snapshot, and market rankings.",
    mockFn: "getMarketStats()",
    response: "MarketStats",
  },
];

export const exchangeApiConsumers = [
  { name: "Alta Terminal", role: "First-party brokerage interface" },
  { name: "Third-party brokerages", role: "Licensed market data & order routing partners" },
  { name: "Institutional clients", role: "Portfolio analytics and research integrations" },
];
