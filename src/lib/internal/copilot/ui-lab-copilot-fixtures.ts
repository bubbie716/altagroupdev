/**
 * Deterministic UI Lab fixtures for Admin Copilot (Phase 1+2).
 * Never calls a live AI provider or mutates records.
 */
import type {
  AdminCopilotEntityMatch,
  AdminCopilotResult,
  AdminCopilotUiLabScenario,
} from "@/lib/internal/copilot/types";
import { createSafeNavigationIntent } from "@/lib/internal/copilot/navigation-safety";
import { readOnlyMutationBlockedMessage } from "@/lib/internal/copilot/mutation-guard";

const FTLCEO_USER: AdminCopilotEntityMatch = {
  entityType: "user",
  entityId: "ui-lab-user-ftlceo",
  label: "FTLCEO",
  sublabel: "Discord · ftlceo · Minecraft · FTLCEO",
  href: "/internal/users/ui-lab-user-ftlceo",
};

const CARTER_USER: AdminCopilotEntityMatch = {
  entityType: "user",
  entityId: "ui-lab-user-carter",
  label: "Carter Townshend",
  sublabel: "Discord · carter · Minecraft · CarterT",
  href: "/internal/users/ui-lab-user-carter",
};

const JANE_USER: AdminCopilotEntityMatch = {
  entityType: "user",
  entityId: "ui-lab-user-jane",
  label: "Jane Smith",
  sublabel: "Discord · janesmith · Minecraft · JaneS",
  href: "/internal/users/ui-lab-user-jane",
};

const FTLCEO_DEAL_ROOM: AdminCopilotEntityMatch = {
  entityType: "deal_room",
  entityId: "ui-lab-deal-ftlceo-1",
  label: "FTLCEO · Personal Credit Line",
  sublabel: "Pending review · ƒ25,000.00",
  status: "ACTIVE",
  updatedAt: "2026-07-28T12:00:00.000Z",
  href: "/internal/lending/applications/ui-lab-app-ftlceo-1/thread",
};

const FTLCEO_DEAL_ROOM_B: AdminCopilotEntityMatch = {
  entityType: "deal_room",
  entityId: "ui-lab-deal-ftlceo-2",
  label: "FTLCEO · Business Credit Line",
  sublabel: "Underwriting · ƒ100,000.00",
  status: "ACTIVE",
  updatedAt: "2026-07-20T12:00:00.000Z",
  href: "/internal/lending/applications/ui-lab-app-ftlceo-2/thread",
};

function corr(scenario: string): string {
  return `ui-lab-copilot-${scenario}`;
}

function navigateDealRoom(
  match: AdminCopilotEntityMatch,
  siteKey: string,
  from?: string,
): AdminCopilotResult {
  const href = `/internal/lending/applications/ui-lab-app-ftlceo-1?section=evidence`;
  const navigation = createSafeNavigationIntent({
    href,
    siteKey,
    reason: "Open FTLCEO deal room (evidence)",
    entityType: "deal_room",
    entityId: match.entityId,
    from,
    section: "evidence",
  });
  return {
    kind: "navigate",
    message: `Opening ${match.label} deal room.`,
    matches: [match],
    navigation: navigation ?? undefined,
    toolUsed: ["searchPeople", "searchDealRooms", "createSafeNavigationIntent"],
    toolProgress: [
      { tool: "searchPeople", label: "Searching people…" },
      { tool: "searchDealRooms", label: "Finding deal rooms…" },
    ],
    correlationId: corr("exact_ftlceo_deal_room"),
    source: "ui_lab",
    providerStatus: "ui_lab",
  };
}

export function resolveUiLabCopilotScenario(
  scenario: AdminCopilotUiLabScenario | string | undefined,
  siteKey: string,
  from?: string,
): AdminCopilotResult | null {
  if (!scenario) return null;

  switch (scenario as AdminCopilotUiLabScenario) {
    case "exact_ftlceo_deal_room":
      return navigateDealRoom(FTLCEO_DEAL_ROOM, siteKey, from);

    case "multiple_people":
      return {
        kind: "ambiguous",
        message: "Multiple people match that name. Choose one to continue.",
        matches: [FTLCEO_USER, CARTER_USER],
        toolUsed: ["searchPeople"],
        toolProgress: [{ tool: "searchPeople", label: "Searching people…" }],
        correlationId: corr("multiple_people"),
        source: "ui_lab",
        providerStatus: "ui_lab",
      };

    case "multiple_deal_rooms":
      return {
        kind: "ambiguous",
        message: "FTLCEO has more than one deal room. Choose which to open.",
        matches: [FTLCEO_DEAL_ROOM, FTLCEO_DEAL_ROOM_B],
        toolUsed: ["searchPeople", "searchDealRooms"],
        correlationId: corr("multiple_deal_rooms"),
        source: "ui_lab",
        providerStatus: "ui_lab",
      };

    case "no_deal_room":
      return {
        kind: "not_found",
        message: "No authorized deal room was found for FTLCEO.",
        matches: [FTLCEO_USER],
        toolUsed: ["searchPeople", "searchDealRooms"],
        correlationId: corr("no_deal_room"),
        source: "ui_lab",
        providerStatus: "ui_lab",
      };

    case "unauthorized_deal_room":
      return {
        kind: "denied",
        message: "You do not have access to that deal room for this site.",
        toolUsed: ["searchDealRooms"],
        correlationId: corr("unauthorized_deal_room"),
        source: "ui_lab",
        providerStatus: "ui_lab",
      };

    case "terminal_only":
    case "terminal_only_operator":
      return {
        kind: "found",
        message: "Terminal site search results (investors and portfolios only).",
        matches: [
          {
            entityType: "terminal_portfolio",
            entityId: "ui-lab-tp-1",
            label: "FTLCEO Personal",
            sublabel: "Personal portfolio",
            href: "/internal/terminal/portfolios/ui-lab-tp-1",
          },
        ],
        toolUsed: ["searchTerminalPortfolios"],
        correlationId: corr("terminal_only"),
        source: "ui_lab",
        providerStatus: "ui_lab",
      };

    case "bank_only":
    case "bank_only_operator":
      return {
        kind: "found",
        message: "Bank accounts for FTLCEO.",
        matches: [
          {
            entityType: "account",
            entityId: "ui-lab-biz-core",
            label: "Alta Group Operating",
            sublabel: "•••• 1204",
            href: "/internal/bank/accounts/ui-lab-biz-core",
          },
        ],
        toolUsed: ["searchAccounts"],
        correlationId: corr("bank_only"),
        source: "ui_lab",
        providerStatus: "ui_lab",
      };

    case "corporate_cross_product":
    case "cross_site_lookup":
      return {
        kind: "found",
        message: "Cross-product matches for Alta Group.",
        matches: [
          {
            entityType: "company",
            entityId: "ui-lab-co-alta",
            label: "Alta Group",
            sublabel: "Ticker · ALTA",
            href: "/internal/companies/ui-lab-co-alta",
          },
          {
            entityType: "loan",
            entityId: "LN-LAB-COMPANY",
            label: "Alta Group · Business Credit Line",
            sublabel: "Active",
            href: "/internal/lending/loans/LN-LAB-COMPANY",
          },
        ],
        toolUsed: ["searchCompanies", "searchLoans"],
        correlationId: corr("corporate_cross_product"),
        source: "ui_lab",
        providerStatus: "ui_lab",
      };

    case "provider_unavailable":
    case "real_provider_unavailable":
      return {
        kind: "unavailable",
        message: "Admin Copilot AI is unavailable. No AI provider is configured.",
        correlationId: corr("provider_unavailable"),
        source: "ui_lab",
        providerStatus: "unavailable",
      };

    case "unsafe_navigation":
      return {
        kind: "error",
        message: "Blocked unsafe navigation intent (external URL rejected).",
        correlationId: corr("unsafe_navigation"),
        source: "ui_lab",
        providerStatus: "ui_lab",
      };

    case "prompt_injection":
      return {
        kind: "found",
        message:
          "Record text was treated as untrusted data. No instructions were followed from the note.",
        matches: [
          {
            entityType: "user",
            entityId: "ui-lab-user-inject",
            label: "Injection Test User",
            sublabel: sanitizeDemoNote(),
            href: "/internal/users/ui-lab-user-inject",
          },
        ],
        toolUsed: ["searchPeople"],
        correlationId: corr("prompt_injection"),
        source: "ui_lab",
        providerStatus: "ui_lab",
      };

    case "exact_person_lookup":
      return {
        kind: "found",
        message: "Matched FTLCEO exactly.",
        matches: [FTLCEO_USER],
        toolUsed: ["searchPeople"],
        toolProgress: [{ tool: "searchPeople", label: "Searching people…" }],
        correlationId: corr("exact_person_lookup"),
        source: "ui_lab",
        providerStatus: "ui_lab",
      };

    case "fuzzy_person_lookup":
      return {
        kind: "ambiguous",
        message: "Fuzzy matches for “jane”. Choose one.",
        matches: [JANE_USER, CARTER_USER],
        toolUsed: ["searchPeople"],
        correlationId: corr("fuzzy_person_lookup"),
        source: "ui_lab",
        providerStatus: "ui_lab",
      };

    case "no_matching_person":
      return {
        kind: "not_found",
        message: `Couldn't find "zzz-unknown".`,
        toolUsed: ["searchPeople"],
        correlationId: corr("no_matching_person"),
        source: "ui_lab",
        providerStatus: "ui_lab",
      };

    case "unauthorized_person":
      return {
        kind: "denied",
        message: "That lookup is not permitted for your role or site.",
        toolUsed: ["searchPeople"],
        correlationId: corr("unauthorized_person"),
        source: "ui_lab",
        providerStatus: "ui_lab",
      };

    case "follow_up_context":
      return {
        kind: "found",
        message: "Showing accounts for FTLCEO (from conversation context).",
        matches: [
          {
            entityType: "account",
            entityId: "ui-lab-biz-core",
            label: "FTLCEO Checking",
            sublabel: "•••• 1002",
            href: "/internal/bank/accounts/ui-lab-biz-core",
          },
        ],
        toolUsed: ["searchAccounts"],
        correlationId: corr("follow_up_context"),
        source: "ui_lab",
        providerStatus: "ui_lab",
      };

    case "provider_timeout":
      return {
        kind: "error",
        message: "Admin Copilot request timed out.",
        correlationId: corr("provider_timeout"),
        source: "ui_lab",
        providerStatus: "ai",
      };

    case "provider_malformed_tool_call":
      return {
        kind: "error",
        message: "Admin Copilot received a malformed AI response.",
        correlationId: corr("provider_malformed_tool_call"),
        source: "ui_lab",
        providerStatus: "ai",
      };

    case "mutation_rejected":
      return {
        kind: "read_only_blocked",
        message: readOnlyMutationBlockedMessage(),
        unavailableAction: {
          kind: "unavailable_action",
          actionCategory: "financial_mutation",
          summary: "give FTLCEO 100k",
        },
        correlationId: corr("mutation_rejected"),
        source: "ui_lab",
        providerStatus: "ui_lab",
      };

    default:
      return null;
  }
}

function sanitizeDemoNote(): string {
  return "[redacted] — note content ignored for planning";
}

/** Infer UI Lab scenario from command text when scenario param omitted. */
export function inferUiLabScenarioFromText(text: string): AdminCopilotUiLabScenario | null {
  const t = text.toLowerCase();
  if (/give\s+ftlceo\s+100k|transfer\s+\d/.test(t)) return "mutation_rejected";
  if (/provider\s+timeout/.test(t)) return "provider_timeout";
  if (/malformed\s+tool/.test(t)) return "provider_malformed_tool_call";
  if (/follow[- ]?up|their accounts|now show/.test(t)) return "follow_up_context";
  if (/fuzzy|jane smith/.test(t)) return "fuzzy_person_lookup";
  if (/zzz-unknown|no matching person/.test(t)) return "no_matching_person";
  if (/exact person|matched ftlceo exactly/.test(t)) return "exact_person_lookup";
  if (/provider\s+unavailable|no\s+ai\s+provider|real.provider.unavailable/.test(t)) {
    return "real_provider_unavailable";
  }
  if (/unsafe\s+navigation|https?:\/\//.test(t)) return "unsafe_navigation";
  if (/ignore previous instructions|prompt injection/.test(t)) return "prompt_injection";
  if (/multiple people|ambiguous people/.test(t)) return "multiple_people";
  if (/multiple deal rooms/.test(t)) return "multiple_deal_rooms";
  if (/no deal room|without a deal room/.test(t)) return "no_deal_room";
  if (/unauthorized person/.test(t)) return "unauthorized_person";
  if (/unauthorized/.test(t)) return "unauthorized_deal_room";
  if (/ftlceo/.test(t) && /deal\s*room/.test(t)) return "exact_ftlceo_deal_room";
  if (/ftlceo/.test(t) && /account/.test(t)) return "bank_only";
  if (/alta group/.test(t) && /loan/.test(t)) return "corporate_cross_product";
  if (/rejected terminal order|terminal portfolio|terminal.only/.test(t)) {
    return "terminal_only";
  }
  return null;
}
