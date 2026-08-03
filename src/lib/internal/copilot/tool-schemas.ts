/**
 * JSON Schema tool definitions for Admin Copilot AI providers.
 * Schemas are server-only — never sent to the browser.
 */
import { ADMIN_COPILOT_TOOL_IDS, type AdminCopilotToolId } from "@/lib/internal/copilot/types";

export type AdminCopilotJsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

export type AdminCopilotToolSchema = {
  name: AdminCopilotToolId;
  description: string;
  parameters: AdminCopilotJsonSchema;
};

const qParam = {
  type: "string",
  description: "Discord/Minecraft/name, company, ticker, account suffix, or id.",
};

const limitParam = {
  type: "number",
  description: "Max results 1–5. Default 5.",
};

/** Tools always available regardless of site. */
const CORE_TOOLS = new Set<AdminCopilotToolId>([
  "searchPeople",
  "searchCompanies",
  "getCustomerSummary",
  "getCompanySummary",
  "getDiscordOpsSummary",
  "getAuditSummary",
  "getJobHealth",
  "createSafeNavigationIntent",
]);

const BANK_TOOLS = new Set<AdminCopilotToolId>([
  "searchAccounts",
  "searchTransactions",
  "searchTransfers",
  "searchLoans",
  "searchLendingApplications",
  "searchDealRooms",
  "searchAltaCards",
  "searchAltaCardApplications",
]);

const TERMINAL_TOOLS = new Set<AdminCopilotToolId>([
  "searchTerminalInvestors",
  "searchTerminalPortfolios",
  "searchTerminalOrders",
  "searchCryptoOrders",
]);

/**
 * Site-scoped schemas — sending every tool on every Groq/OpenAI call burns TPM.
 * Corporate keeps bank + terminal; bank/lending omit Terminal; Terminal omits bank money tools.
 */
export function toolSchemasForSite(siteKey: string): AdminCopilotToolSchema[] {
  const site = siteKey.trim().toLowerCase();
  const allowed = new Set<AdminCopilotToolId>(CORE_TOOLS);
  if (site === "terminal") {
    for (const id of TERMINAL_TOOLS) allowed.add(id);
  } else if (site === "bank" || site === "lending") {
    for (const id of BANK_TOOLS) allowed.add(id);
  } else {
    // corporate / unknown — both surfaces
    for (const id of BANK_TOOLS) allowed.add(id);
    for (const id of TERMINAL_TOOLS) allowed.add(id);
  }
  return ADMIN_COPILOT_TOOL_SCHEMAS.filter((s) => allowed.has(s.name));
}

export const ADMIN_COPILOT_TOOL_SCHEMAS: AdminCopilotToolSchema[] = [
  {
    name: "searchPeople",
    description: "Authorized people (Discord/Minecraft/name).",
    parameters: {
      type: "object",
      properties: { q: qParam, limit: limitParam },
      required: ["q"],
      additionalProperties: false,
    },
  },
  {
    name: "searchCompanies",
    description: "Authorized companies by name/ticker/id.",
    parameters: {
      type: "object",
      properties: { q: qParam, limit: limitParam },
      required: ["q"],
      additionalProperties: false,
    },
  },
  {
    name: "searchAccounts",
    description: "Alta Bank accounts (username, name, or number suffix).",
    parameters: {
      type: "object",
      properties: { q: qParam, limit: limitParam },
      required: ["q"],
      additionalProperties: false,
    },
  },
  {
    name: "searchTransactions",
    description: "Bank transactions / deposits / withdrawals.",
    parameters: {
      type: "object",
      properties: { q: qParam, limit: limitParam },
      required: ["q"],
      additionalProperties: false,
    },
  },
  {
    name: "searchTransfers",
    description: "Transfers / Alta Pay. latest=true for newest.",
    parameters: {
      type: "object",
      properties: {
        q: qParam,
        latest: { type: "boolean", description: "Prefer newest matches" },
        limit: limitParam,
      },
      required: ["q"],
      additionalProperties: false,
    },
  },
  {
    name: "searchTerminalInvestors",
    description: "Terminal investors.",
    parameters: {
      type: "object",
      properties: { q: qParam, limit: limitParam },
      required: ["q"],
      additionalProperties: false,
    },
  },
  {
    name: "searchTerminalPortfolios",
    description: "Terminal portfolios.",
    parameters: {
      type: "object",
      properties: { q: qParam, limit: limitParam },
      required: ["q"],
      additionalProperties: false,
    },
  },
  {
    name: "searchTerminalOrders",
    description: "Terminal stock/crypto orders. Optional statusHint.",
    parameters: {
      type: "object",
      properties: {
        q: qParam,
        statusHint: { type: "string" },
        limit: limitParam,
      },
      required: ["q"],
      additionalProperties: false,
    },
  },
  {
    name: "searchCryptoOrders",
    description: "Terminal crypto orders/assets.",
    parameters: {
      type: "object",
      properties: { q: qParam, limit: limitParam },
      required: ["q"],
      additionalProperties: false,
    },
  },
  {
    name: "searchLoans",
    description: "Loans. Optional statusHint.",
    parameters: {
      type: "object",
      properties: {
        q: qParam,
        statusHint: { type: "string" },
        limit: limitParam,
      },
      required: ["q"],
      additionalProperties: false,
    },
  },
  {
    name: "searchLendingApplications",
    description: "Lending applications / underwriting.",
    parameters: {
      type: "object",
      properties: {
        q: qParam,
        statusHint: { type: "string" },
        limit: limitParam,
      },
      required: ["q"],
      additionalProperties: false,
    },
  },
  {
    name: "searchDealRooms",
    description: "Deal rooms / lending evidence. preferActive for open rooms.",
    parameters: {
      type: "object",
      properties: {
        q: qParam,
        preferActive: { type: "boolean" },
        limit: limitParam,
      },
      required: ["q"],
      additionalProperties: false,
    },
  },
  {
    name: "searchAltaCards",
    description: "Alta Card accounts.",
    parameters: {
      type: "object",
      properties: { q: qParam, limit: limitParam },
      required: ["q"],
      additionalProperties: false,
    },
  },
  {
    name: "searchAltaCardApplications",
    description: "Alta Card applications.",
    parameters: {
      type: "object",
      properties: { q: qParam, limit: limitParam },
      required: ["q"],
      additionalProperties: false,
    },
  },
  {
    name: "getCustomerSummary",
    description: "Customer overview + authorized bank balances. Prefer for balance questions.",
    parameters: {
      type: "object",
      properties: { q: qParam, userId: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "getCompanySummary",
    description: "Company overview (presentation-safe).",
    parameters: {
      type: "object",
      properties: { q: qParam, companyId: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "getDiscordOpsSummary",
    description: "Discord ops / dead-letter summary (no raw payloads).",
    parameters: {
      type: "object",
      properties: { focus: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "getAuditSummary",
    description: "Recent audit hits in operator scope.",
    parameters: {
      type: "object",
      properties: { focus: { type: "string" }, window: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "getJobHealth",
    description: "Job health / recent runs.",
    parameters: {
      type: "object",
      properties: { window: { type: "string" } },
      additionalProperties: false,
    },
  },
  {
    name: "createSafeNavigationIntent",
    description:
      "Navigate to one resolved match. prefer: deal_room|user|company|account|loan|transaction|terminal_portfolio|terminal_order|alta_card.",
    parameters: {
      type: "object",
      properties: {
        prefer: { type: "string" },
        entityId: { type: "string" },
        entityType: { type: "string" },
      },
      additionalProperties: false,
    },
  },
];

export function assertToolSchemasCoverAllowlist(): void {
  const named = new Set(ADMIN_COPILOT_TOOL_SCHEMAS.map((s) => s.name));
  for (const id of ADMIN_COPILOT_TOOL_IDS) {
    if (!named.has(id)) {
      throw new Error(`Missing tool schema for ${id}`);
    }
  }
}

export function toolProgressLabel(tool: string): string {
  switch (tool) {
    case "searchPeople":
      return "Searching people…";
    case "searchCompanies":
      return "Searching companies…";
    case "searchAccounts":
      return "Searching accounts…";
    case "searchTransactions":
      return "Searching transactions…";
    case "searchTransfers":
      return "Finding transfers…";
    case "searchTerminalInvestors":
      return "Searching Terminal investors…";
    case "searchTerminalPortfolios":
      return "Searching Terminal portfolios…";
    case "searchTerminalOrders":
      return "Searching Terminal orders…";
    case "searchCryptoOrders":
      return "Searching crypto orders…";
    case "searchLoans":
      return "Searching loans…";
    case "searchLendingApplications":
      return "Finding lending applications…";
    case "searchDealRooms":
      return "Finding deal rooms…";
    case "searchAltaCards":
      return "Searching Alta Cards…";
    case "searchAltaCardApplications":
      return "Searching card applications…";
    case "getCustomerSummary":
      return "Loading customer summary…";
    case "getCompanySummary":
      return "Loading company summary…";
    case "getDiscordOpsSummary":
      return "Checking Discord ops…";
    case "getAuditSummary":
      return "Searching audit events…";
    case "getJobHealth":
      return "Checking job health…";
    case "createSafeNavigationIntent":
      return "Preparing navigation…";
    default:
      return "Working…";
  }
}
