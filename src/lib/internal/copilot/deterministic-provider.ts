/**
 * Deterministic Admin Copilot provider — Phase 1.
 * Maps supported natural-language phrases to allowlisted tools only.
 * Never invents entity facts.
 */
import type {
  AdminCopilotCommand,
  AdminCopilotProvider,
  AdminCopilotResult,
  AdminCopilotToolCall,
} from "@/lib/internal/copilot/types";
import {
  commandMentionsAccounts,
  commandMentionsCustomerRecord,
  commandMentionsDealRoom,
  commandMentionsDiscordDeadLetter,
  commandMentionsFailed,
  commandMentionsLoans,
  commandMentionsTerminalOrder,
  commandMentionsTransfer,
  commandWantsOpen,
  extractSubjectFromCommand,
} from "@/lib/internal/copilot/entity-resolution";

function newCorrelationId(): string {
  return `copilot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createDeterministicAdminCopilotProvider(): AdminCopilotProvider {
  return {
    name: "deterministic",
    async plan(command: AdminCopilotCommand): Promise<AdminCopilotToolCall[] | AdminCopilotResult> {
      const text = command.text.trim();
      if (!text) {
        return {
          kind: "error",
          message: "Enter a command to search or open a record.",
          correlationId: newCorrelationId(),
        };
      }

      const subject = extractSubjectFromCommand(text);
      const siteKey = command.siteKey;
      const terminalOnly = siteKey === "terminal" || siteKey === "exchange";

      if (commandMentionsDiscordDeadLetter(text)) {
        return [{ tool: "getDiscordOpsSummary", args: { focus: "dead_letter" } }];
      }

      if (commandMentionsFailed(text)) {
        return [
          { tool: "getJobHealth", args: { window: "today" } },
          { tool: "getAuditSummary", args: { focus: "failures", window: "today" } },
        ];
      }

      if (commandMentionsTerminalOrder(text) || (terminalOnly && /\border\b/i.test(text))) {
        return [
          {
            tool: "searchTerminalOrders",
            args: { q: subject ?? text, statusHint: /reject/i.test(text) ? "rejected" : undefined },
          },
        ];
      }

      if (commandMentionsDealRoom(text)) {
        const q = subject ?? "deal room";
        return [
          { tool: "searchPeople", args: { q } },
          { tool: "searchDealRooms", args: { q, preferActive: true } },
          ...(commandWantsOpen(text)
            ? [{ tool: "createSafeNavigationIntent" as const, args: { prefer: "deal_room" } }]
            : []),
        ];
      }

      if (commandMentionsAccounts(text) && subject) {
        return [
          { tool: "searchPeople", args: { q: subject } },
          { tool: "searchAccounts", args: { q: subject } },
        ];
      }

      if (commandMentionsLoans(text)) {
        const q = subject ?? text;
        return [
          { tool: "searchCompanies", args: { q } },
          { tool: "searchLoans", args: { q, statusHint: /active/i.test(text) ? "ACTIVE" : undefined } },
        ];
      }

      if (commandMentionsTransfer(text)) {
        const q = subject ?? text;
        return [
          { tool: "searchPeople", args: { q } },
          { tool: "searchTransfers", args: { q, latest: true } },
        ];
      }

      if (commandMentionsCustomerRecord(text) || (commandWantsOpen(text) && subject && !commandMentionsDealRoom(text))) {
        const q = subject ?? text;
        if (terminalOnly) {
          return [{ tool: "searchTerminalInvestors", args: { q } }];
        }
        return [
          { tool: "searchPeople", args: { q } },
          ...(commandWantsOpen(text)
            ? [{ tool: "createSafeNavigationIntent" as const, args: { prefer: "user" } }]
            : []),
        ];
      }

      // Generic search fallback — still allowlisted tools only
      const q = subject ?? text;
      if (terminalOnly) {
        return [
          { tool: "searchTerminalInvestors", args: { q } },
          { tool: "searchTerminalPortfolios", args: { q } },
          { tool: "searchCompanies", args: { q } },
        ];
      }

      return [
        { tool: "searchPeople", args: { q } },
        { tool: "searchCompanies", args: { q } },
        { tool: "searchAccounts", args: { q } },
      ];
    },
  };
}

export function createUnavailableAdminCopilotProvider(message?: string): AdminCopilotProvider {
  return {
    name: "unavailable",
    async plan(): Promise<AdminCopilotResult> {
      return {
        kind: "unavailable",
        message:
          message ??
          "Admin Copilot is unavailable. No AI provider is configured for this environment.",
        correlationId: newCorrelationId(),
        source: "unavailable",
      };
    },
  };
}
