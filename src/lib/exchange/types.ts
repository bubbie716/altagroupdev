export type ListingStatus = "Listed" | "Halted" | "Suspended";

export interface ListedCompany {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  volume: number;
  marketCap: number;
  status: ListingStatus;
}

export interface CompanyProfile extends ListedCompany {
  exchange: string;
  sharesOutstanding: number;
  ceo: string;
  headquarters: string;
  description: string;
  shareholders: { name: string; pct: number }[];
  filings: { title: string; date: string; type: string }[];
  corporateActions: { action: string; detail: string }[];
  news: { date: string; headline: string }[];
  keyStats: { label: string; value: string }[];
  priceSeries: { t: number; v: number }[];
}

export interface ExchangeIndex {
  symbol: string;
  name: string;
  value: number;
  change: number;
  constituents: number;
  category: string;
  series: { t: number; v: number }[];
}

export type IPOStage = "open" | "upcoming" | "recent";

export interface IPOListing {
  company: string;
  ticker: string;
  offeringPrice?: string;
  expectedPrice?: string;
  sharesOffered?: string;
  raiseSize?: string;
  listingPrice?: string;
  currentPrice?: string;
  returnSinceListing?: string;
  status: string;
  stage: IPOStage;
}

export interface CorporateAction {
  ticker: string;
  company: string;
  type: string;
  detail: string;
  category: "dividends" | "splits" | "buybacks" | "mergers" | "tenders";
  date: string;
}

export type ResearchSection = "commentary" | "filings" | "prospectuses" | "economic" | "notices";

export interface ResearchDocument {
  title: string;
  category: string;
  date: string;
  issuer: string;
  section: ResearchSection;
}

export interface RankingEntry {
  rank: number;
  ticker: string;
  company: string;
  value: string;
  change?: number;
}

export interface MarketRankings {
  gainers: RankingEntry[];
  losers: RankingEntry[];
  mostActive: RankingEntry[];
  largest: RankingEntry[];
  highestVolume: RankingEntry[];
}

export interface ExchangeStat {
  label: string;
  value: string;
}

export interface MarketSnapshot {
  index: ExchangeIndex;
  status: string;
  time: string;
  turnover: string;
  listed: number;
}

export interface MarketStats {
  description: string;
  stats: ExchangeStat[];
  snapshot: MarketSnapshot;
  rankings: MarketRankings;
}

export type AnnouncementType = "corporate" | "financial";

export interface CorporateAnnouncement {
  id: string;
  ticker: string;
  date: string;
  title: string;
  body: string;
  type: AnnouncementType;
  attachment?: { name: string; size: string };
}
