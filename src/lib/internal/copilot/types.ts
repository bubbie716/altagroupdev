/**
 * Admin Copilot Phase 2 — shared types (AI tool-calling, read-only).
 * Browser-safe: no provider secrets, prompts, or raw DB payloads.
 */

export const ADMIN_COPILOT_TOOL_IDS = [
  "searchPeople",
  "searchCompanies",
  "searchAccounts",
  "searchTransactions",
  "searchTransfers",
  "searchTerminalInvestors",
  "searchTerminalPortfolios",
  "searchTerminalOrders",
  "searchCryptoOrders",
  "searchLoans",
  "searchLendingApplications",
  "searchDealRooms",
  "searchAltaCards",
  "searchAltaCardApplications",
  "getCustomerSummary",
  "getCompanySummary",
  "getDiscordOpsSummary",
  "getAuditSummary",
  "getJobHealth",
  "createSafeNavigationIntent",
] as const;

export type AdminCopilotToolId = (typeof ADMIN_COPILOT_TOOL_IDS)[number];

export type AdminCopilotEntityType =
  | "user"
  | "company"
  | "account"
  | "transaction"
  | "transfer"
  | "loan"
  | "lending_application"
  | "deal_room"
  | "alta_card"
  | "alta_card_application"
  | "terminal_portfolio"
  | "terminal_order"
  | "terminal_crypto_order"
  | "audit"
  | "job"
  | "discord_ops"
  | "unknown";

export type AdminCopilotResultKind =
  | "found"
  | "ambiguous"
  | "not_found"
  | "denied"
  | "navigate"
  | "summary"
  | "unavailable"
  | "error"
  | "read_only_blocked";

export type AdminCopilotEntityMatch = {
  entityType: AdminCopilotEntityType;
  entityId: string;
  label: string;
  sublabel?: string;
  status?: string;
  updatedAt?: string;
  /** Canonical internal href — never external. */
  href: string;
};

export type AdminCopilotNavigationIntent = {
  kind: "navigate";
  to: string;
  search: Record<string, string>;
  reason: string;
  entityType: string;
  entityId: string;
};

/** Future-phase placeholder — never executes mutations in Phase 2. */
export type AdminCopilotUnavailableActionIntent = {
  kind: "unavailable_action";
  actionCategory: "financial_mutation" | "admin_mutation" | "unknown";
  summary: string;
};

export type AdminCopilotCommand = {
  text: string;
  siteKey: string;
  /** Optional UI Lab scenario id. */
  scenario?: string;
  /** Current internal pathname for context (not executed as navigation). */
  currentPath?: string;
  /** Safe relative return path. */
  from?: string;
  /**
   * Short-lived conversation id (client-generated). Scoped server-side to
   * the acting operator — never crosses users/sites.
   */
  conversationId?: string;
};

export type AdminCopilotToolProgress = {
  tool: string;
  label: string;
};

export type AdminCopilotResult = {
  kind: AdminCopilotResultKind;
  message: string;
  /**
   * Straight operator-facing headline (e.g. "ƒ92,500.00").
   * Shown above the supporting message; sources link via matches.
   */
  answer?: string;
  matches?: AdminCopilotEntityMatch[];
  navigation?: AdminCopilotNavigationIntent;
  unavailableAction?: AdminCopilotUnavailableActionIntent;
  toolUsed?: string[];
  toolProgress?: AdminCopilotToolProgress[];
  correlationId: string;
  /** Presentation-safe freshness/source note. */
  source?: string;
  /** Provider status for UI badge. */
  providerStatus?: "ai" | "unavailable" | "ui_lab" | "deterministic";
  latencyMs?: number;
};

export type AdminCopilotToolCall = {
  tool: AdminCopilotToolId;
  args: Record<string, unknown>;
  /** Provider-assigned call id when present. */
  callId?: string;
};

export type AdminCopilotToolResult = {
  callId?: string;
  tool: AdminCopilotToolId;
  ok: boolean;
  /** Presentation-safe, bounded payload for the model — never secrets. */
  content: string;
  matches?: AdminCopilotEntityMatch[];
  navigation?: AdminCopilotNavigationIntent | null;
  denied?: boolean;
  /** Straight headline answer when the tool can compute one. */
  answer?: string;
};

export type AdminCopilotTurn = {
  role: "user" | "assistant" | "tool";
  /** User or assistant text — never includes secrets. */
  text?: string;
  toolCall?: AdminCopilotToolCall;
  toolResult?: AdminCopilotToolResult;
};

export type AdminCopilotProviderName =
  | "openai"
  | "anthropic"
  | "deterministic"
  | "unavailable"
  | "ui_lab";

export type AdminCopilotProvider = {
  name: AdminCopilotProviderName;
  /**
   * Plan tool calls from a natural-language command.
   * Must never invent entity facts — only propose allowlisted tools.
   * AI providers may return an early AdminCopilotResult (unavailable/error).
   */
  plan(command: AdminCopilotCommand): Promise<AdminCopilotToolCall[] | AdminCopilotResult>;
};

/**
 * Full AI turn runner — used by Phase 2 providers that need multi-step tool calling.
 * The orchestrator supplies `executeTool` so the model never touches Prisma/SQL.
 */
export type AdminCopilotAiRunner = {
  name: AdminCopilotProviderName;
  run(input: {
    command: AdminCopilotCommand;
    contextSummary?: string;
    executeTool: (call: AdminCopilotToolCall) => Promise<AdminCopilotToolResult>;
    signal?: AbortSignal;
  }): Promise<AdminCopilotResult>;
};

export const ADMIN_COPILOT_EXAMPLE_PROMPTS = [
  "Open FTLCEO's deal room.",
  "Open Jane Smith’s Alta Bank account.",
  "Show me Carter’s latest transfers.",
  "What products does this customer use?",
  "Find all companies associated with this person.",
  "Open the latest pending loan application for FTLCEO.",
  "Show me people with failed transfers today.",
  "Show dead-letter Discord deliveries.",
] as const;

export type AdminCopilotUiLabScenario =
  | "exact_ftlceo_deal_room"
  | "multiple_people"
  | "multiple_deal_rooms"
  | "no_deal_room"
  | "unauthorized_deal_room"
  | "terminal_only"
  | "bank_only"
  | "corporate_cross_product"
  | "provider_unavailable"
  | "unsafe_navigation"
  | "prompt_injection"
  | "real_provider_unavailable"
  | "exact_person_lookup"
  | "fuzzy_person_lookup"
  | "no_matching_person"
  | "unauthorized_person"
  | "follow_up_context"
  | "cross_site_lookup"
  | "terminal_only_operator"
  | "bank_only_operator"
  | "provider_timeout"
  | "provider_malformed_tool_call"
  | "mutation_rejected";

/** Max results returned from any single tool. */
export const ADMIN_COPILOT_MAX_TOOL_RESULTS = 5;
/** Max tool calls per AI turn (each extra round re-sends tools + history). */
export const ADMIN_COPILOT_MAX_TOOL_CALLS = 4;
/** Provider request timeout (ms). */
export const ADMIN_COPILOT_PROVIDER_TIMEOUT_MS = 25_000;
/** Max chars of each tool result fed back into the model. */
export const ADMIN_COPILOT_TOOL_RESULT_CHARS = 1_200;

