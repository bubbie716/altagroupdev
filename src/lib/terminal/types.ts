export type TerminalNewsItem = {
  date: string;
  headline: string;
  category: "Market" | "Company" | "Exchange" | "Bank" | "Macro";
  source: string;
};

export type LeaderboardRow = {
  rank: number;
  name: string;
  value: string;
  detail?: string;
  change?: number;
  ticker?: string;
};

export type LeaderboardTickerRow = {
  rank: number;
  ticker: string;
  name: string;
  value: string;
  change: number;
};

export type TerminalResearchItem = {
  title: string;
  category: string;
  date: string;
  issuer: string;
  section: string;
};
