export type OpsReportPeriod = "today" | "7d" | "30d" | "custom";

export type OpsReportFilters = {
  period?: OpsReportPeriod;
  from?: string;
  to?: string;
};

export type OpsReportRow = {
  key: string;
  label: string;
  count: number;
  totalAmount: number;
};

export type OpsReportsBundle = {
  periodLabel: string;
  from: string;
  to: string;
  reports: OpsReportRow[];
};
