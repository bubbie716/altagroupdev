/** Canonical registry of platform scheduled jobs shown on /internal/jobs. */
export type OpsJobCatalogEntry = {
  jobKey: string;
  label: string;
  description: string;
  cronEndpoint?: string;
  nextSchedule: string;
  /** When set, admins may trigger this job manually from the jobs console. */
  manualRunKey?: string;
  manualImpact?: string;
};

export const OPS_JOBS_CATALOG: OpsJobCatalogEntry[] = [
  {
    jobKey: "scheduled_transfers",
    label: "Scheduled transfers",
    description: "Executes due intrabank scheduled Alta-to-Alta transfers.",
    cronEndpoint: "/api/cron/scheduled-transfers",
    nextSchedule: "Daily via cron",
    manualRunKey: "scheduled_transfers",
    manualImpact:
      "Processes all due scheduled transfers immediately. Failed transfers increment consecutive failure counts.",
  },
  {
    jobKey: "payroll",
    label: "Payroll batches",
    description: "Executes due company payroll payment batches.",
    cronEndpoint: "/api/cron/scheduled-transfers",
    nextSchedule: "Daily via cron (shared with scheduled transfers)",
    manualRunKey: "payroll",
    manualImpact: "Processes all due payroll batches immediately.",
  },
  {
    jobKey: "BANK_ACCOUNT_STATEMENTS",
    label: "Bank account statements",
    description: "Generates monthly PDF statements for eligible bank accounts.",
    cronEndpoint: "/api/cron/daily-servicing",
    nextSchedule: "Daily cron · generates on the 1st of each month",
    manualRunKey: "BANK_ACCOUNT_STATEMENTS",
    manualImpact:
      "Force-generates previous-month statements for all eligible accounts. Existing statements for that period are skipped.",
  },
  {
    jobKey: "deposit_interest",
    label: "Deposit interest",
    description: "Daily deposit accrual and scheduled manual interest application.",
    cronEndpoint: "/api/cron/daily-servicing",
    nextSchedule: "Daily via cron",
  },
  {
    jobKey: "loan_servicing",
    label: "Loan servicing",
    description: "Loan interest accrual and automatic loan payments.",
    cronEndpoint: "/api/cron/daily-servicing",
    nextSchedule: "Daily via cron",
    manualRunKey: "loan_servicing",
    manualImpact: "Runs loan interest accrual and due autopay processing immediately.",
  },
  {
    jobKey: "ALTA_CARD_STATEMENTS",
    label: "Alta Card statements",
    description: "Generates Alta Card billing cycle statements at month end.",
    cronEndpoint: "/api/cron/daily-servicing",
    nextSchedule: "Daily cron · generates on calendar month end",
    manualRunKey: "ALTA_CARD_STATEMENTS",
    manualImpact: "Force-runs Alta Card statement generation for all eligible cards.",
  },
  {
    jobKey: "ALTA_CARD_BILLING",
    label: "Alta Card billing",
    description: "Overdue marking, interest, late fees, and autopay processing for Alta Card.",
    cronEndpoint: "/api/cron/daily-servicing",
    nextSchedule: "Daily via cron",
    manualRunKey: "ALTA_CARD_BILLING",
    manualImpact:
      "Runs billing processing for all active Alta Card accounts including autopay attempts.",
  },
  {
    jobKey: "relationship_intelligence",
    label: "Relationship Intelligence refresh",
    description: "Recalculates personal relationship profiles and tiers for all customers.",
    cronEndpoint: "/api/cron/relationship-intelligence",
    nextSchedule: "Daily via cron",
    manualRunKey: "relationship_intelligence",
    manualImpact: "Refreshes all personal relationship profiles. May take several minutes.",
  },
  {
    jobKey: "relationship_recommendations",
    label: "Relationship recommendations",
    description: "Generates personal relationship product recommendations.",
    cronEndpoint: "/api/cron/relationship-intelligence",
    nextSchedule: "Daily via cron",
    manualRunKey: "relationship_recommendations",
    manualImpact: "Regenerates recommendations for all personal relationship profiles.",
  },
  {
    jobKey: "company_relationship_intelligence",
    label: "Company Relationship Intelligence refresh",
    description: "Recalculates company relationship profiles and commercial tiers.",
    cronEndpoint: "/api/cron/relationship-intelligence",
    nextSchedule: "Daily via cron",
    manualRunKey: "company_relationship_intelligence",
    manualImpact: "Refreshes all company relationship profiles.",
  },
  {
    jobKey: "company_relationship_recommendations",
    label: "Company recommendations",
    description: "Generates company relationship product recommendations.",
    cronEndpoint: "/api/cron/relationship-intelligence",
    nextSchedule: "Daily via cron",
    manualRunKey: "company_relationship_recommendations",
    manualImpact: "Regenerates recommendations for all company relationship profiles.",
  },
];

export function getOpsJobCatalogEntry(jobKey: string): OpsJobCatalogEntry | undefined {
  return OPS_JOBS_CATALOG.find((j) => j.jobKey === jobKey);
}
