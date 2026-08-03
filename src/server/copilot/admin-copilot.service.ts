/**
 * Admin Copilot Phase 2 orchestrator — AI tool-calling + read-only navigation.
 */
import type { SiteKey } from "@/config/sites";
import type { AltaUser } from "@/lib/auth/types";
import { canAccessInternalForSite } from "@/lib/auth/permissions";
import { isUiLabMode } from "@/lib/auth/ui-lab";
import {
  createDeterministicAdminCopilotProvider,
  createUnavailableAdminCopilotProvider,
} from "@/lib/internal/copilot/deterministic-provider";
import {
  extractSubjectFromCommand,
  notFoundMessageForSubject,
} from "@/lib/internal/copilot/entity-resolution";
import {
  inferUiLabScenarioFromText,
  resolveUiLabCopilotScenario,
} from "@/lib/internal/copilot/ui-lab-copilot-fixtures";
import type {
  AdminCopilotCommand,
  AdminCopilotEntityMatch,
  AdminCopilotProvider,
  AdminCopilotResult,
  AdminCopilotToolCall,
  AdminCopilotToolId,
} from "@/lib/internal/copilot/types";
import { ADMIN_COPILOT_TOOL_IDS } from "@/lib/internal/copilot/types";
import { validateNavigationIntent } from "@/lib/internal/copilot/navigation-safety";
import { containsPromptInjectionAttempt } from "@/lib/internal/copilot/prompt-safety";
import {
  detectMutationRequest,
  readOnlyMutationBlockedMessage,
} from "@/lib/internal/copilot/mutation-guard";
import { toolProgressLabel } from "@/lib/internal/copilot/tool-schemas";
import {
  executeAllowlistedCopilotTool,
  type AdminCopilotToolContext,
} from "@/server/copilot/admin-copilot-tools.service";
import {
  createAiAdminCopilotRunner,
  resolveAdminCopilotAiConfig,
} from "@/server/copilot/ai-provider";
import {
  formatContextSummaryForModel,
  getCopilotConversationContext,
  updateCopilotConversationContext,
  commandNeedsConversationContext,
} from "@/server/copilot/conversation-context";
import { requireAuth } from "@/server/auth.service";
import { assertUserRateLimit } from "@/server/rate-limit.service";
import { writeAuditLog } from "@/server/audit.service";

function correlationId(): string {
  return `copilot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function requireCopilotAccess(siteKey: SiteKey): Promise<AltaUser> {
  const { getUiLabUserIfEnabled } = await import("@/lib/auth/ui-lab");
  const labUser = getUiLabUserIfEnabled();
  if (labUser) return labUser;
  const user = await requireAuth();
  if (!canAccessInternalForSite(user, siteKey)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}

function isAiRequired(): boolean {
  return process.env.ADMIN_COPILOT_REQUIRE_AI === "true";
}

function isCopilotDisabled(): boolean {
  return process.env.ADMIN_COPILOT_ENABLED === "false";
}

export function resolveAdminCopilotProvider(_command?: AdminCopilotCommand): AdminCopilotProvider {
  if (isUiLabMode()) {
    return createDeterministicAdminCopilotProvider();
  }
  if (isCopilotDisabled()) {
    return createUnavailableAdminCopilotProvider(
      "Admin Copilot is disabled in this environment.",
    );
  }
  const ai = resolveAdminCopilotAiConfig();
  if (!ai) {
    return createUnavailableAdminCopilotProvider(
      "Admin Copilot AI is unavailable. No AI provider is configured.",
    );
  }
  // Full multi-step AI runs through createAiAdminCopilotRunner in runAdminCopilotCommand.
  return {
    name: ai.provider,
    async plan() {
      return {
        kind: "error",
        message: "Use runAdminCopilotCommand for AI tool-calling turns.",
        correlationId: correlationId(),
        source: ai.provider,
        providerStatus: "ai",
      };
    },
  };
}

async function writeCopilotAudit(input: {
  actorUserId: string;
  category: string;
  toolUsed?: string[];
  entityType?: string;
  entityId?: string;
  result: AdminCopilotResult["kind"];
  correlationId: string;
  siteKey?: string;
  latencyMs?: number;
}): Promise<void> {
  if (isUiLabMode()) return;
  try {
    await writeAuditLog({
      actorUserId: input.actorUserId,
      action: "ADMIN_COPILOT_QUERY",
      entityType: "PLATFORM",
      entityId: input.entityId,
      description: `Admin Copilot ${input.category}: ${input.result}`,
      metadata: {
        source: "OPERATOR",
        severity: "info",
        category: input.category,
        toolUsed: input.toolUsed,
        entityType: input.entityType,
        result: input.result,
        correlationId: input.correlationId,
        site: input.siteKey,
        latencyMs: input.latencyMs,
      },
    });
  } catch {
    // Soft — audit must not block read-only assistant
  }
}

function dedupeMatches(matches: AdminCopilotEntityMatch[]): AdminCopilotEntityMatch[] {
  const seen = new Set<string>();
  const out: AdminCopilotEntityMatch[] = [];
  for (const m of matches) {
    const key = `${m.entityType}:${m.entityId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

function finalizeNavigation(
  result: AdminCopilotResult,
  siteKey: SiteKey,
  user: AltaUser,
): AdminCopilotResult {
  if (!result.navigation) return result;
  const validated = validateNavigationIntent(result.navigation, { siteKey, user });
  if (!validated.ok) {
    return {
      ...result,
      navigation: undefined,
      kind: result.matches && result.matches.length > 1 ? "ambiguous" : result.kind === "navigate" ? "error" : result.kind,
      message: validated.reason,
    };
  }
  return { ...result, navigation: validated.intent };
}

async function runDeterministicToolPlan(
  plan: AdminCopilotToolCall[],
  ctx: AdminCopilotToolContext,
  corr: string,
  source: string,
): Promise<AdminCopilotResult> {
  const toolsUsed: AdminCopilotToolId[] = [];
  const toolProgress = [];
  let summary: string | undefined;
  let navigation: AdminCopilotResult["navigation"] | undefined;

  for (const call of plan) {
    if (!ADMIN_COPILOT_TOOL_IDS.includes(call.tool)) continue;
    toolsUsed.push(call.tool);
    toolProgress.push({ tool: call.tool, label: toolProgressLabel(call.tool) });
    const out = await executeAllowlistedCopilotTool(call.tool, call.args, ctx, call.callId);
    if (out.denied) {
      return {
        kind: "denied",
        message: "That lookup is not permitted for your role or site.",
        toolUsed: toolsUsed,
        toolProgress,
        correlationId: corr,
        source,
        providerStatus: "ui_lab",
      };
    }
    if (out.matches?.length) {
      ctx.matches = dedupeMatches([...ctx.matches, ...out.matches]);
    }
    if (out.content) {
      try {
        const parsed = JSON.parse(out.content) as { summary?: string };
        if (parsed.summary) summary = parsed.summary;
      } catch {
        /* ignore */
      }
    }
    if (out.navigation) navigation = out.navigation ?? undefined;
  }

  if (navigation && ctx.matches.length <= 1) {
    return {
      kind: "navigate",
      message: summary ?? navigation.reason,
      matches: ctx.matches.slice(0, 1),
      navigation,
      toolUsed: toolsUsed,
      toolProgress,
      correlationId: corr,
      source,
    };
  }
  if (ctx.matches.length === 0) {
    return {
      kind: "not_found",
      message: summary ?? "Couldn't find a matching authorized record.",
      toolUsed: toolsUsed,
      toolProgress,
      correlationId: corr,
      source,
    };
  }
  if (ctx.matches.length > 1) {
    return {
      kind: "ambiguous",
      message: summary ?? "Multiple matches. Choose a record to open.",
      matches: ctx.matches.slice(0, 8),
      toolUsed: toolsUsed,
      toolProgress,
      correlationId: corr,
      source,
    };
  }
  return {
    kind: "found",
    message: summary ?? `Found ${ctx.matches.length} authorized match(es).`,
    matches: ctx.matches.slice(0, 8),
    navigation,
    toolUsed: toolsUsed,
    toolProgress,
    correlationId: corr,
    source,
  };
}

export async function runAdminCopilotCommand(
  command: AdminCopilotCommand,
): Promise<AdminCopilotResult> {
  const started = Date.now();
  const siteKey = (command.siteKey || "corporate") as SiteKey;
  const user = await requireCopilotAccess(siteKey);
  assertUserRateLimit(user.id, "admin-copilot", 30, 60_000);

  const corr = correlationId();

  // Mutation requests — never execute (Phase 2 read-only).
  const mutation = detectMutationRequest(command.text);
  if (mutation && !isUiLabMode()) {
    const result: AdminCopilotResult = {
      kind: "read_only_blocked",
      message: readOnlyMutationBlockedMessage(),
      unavailableAction: mutation,
      correlationId: corr,
      providerStatus: "ai",
      latencyMs: Date.now() - started,
    };
    await writeCopilotAudit({
      actorUserId: user.id,
      category: "mutation_blocked",
      result: "read_only_blocked",
      correlationId: corr,
      siteKey,
      latencyMs: result.latencyMs,
    });
    return result;
  }

  // UI Lab short-circuit with fixtures (no live AI, no mutations)
  if (isUiLabMode()) {
    const scenario =
      command.scenario || inferUiLabScenarioFromText(command.text) || undefined;
    const fixture = resolveUiLabCopilotScenario(scenario, siteKey, command.from);
    if (fixture) {
      const withMeta: AdminCopilotResult = {
        ...fixture,
        correlationId: fixture.correlationId || corr,
        providerStatus: fixture.kind === "unavailable" ? "unavailable" : "ui_lab",
        latencyMs: Date.now() - started,
      };
      return withMeta;
    }
  }

  if (isCopilotDisabled()) {
    const result = await createUnavailableAdminCopilotProvider(
      "Admin Copilot is disabled in this environment.",
    ).plan(command);
    return {
      ...(result as AdminCopilotResult),
      providerStatus: "unavailable",
      latencyMs: Date.now() - started,
    };
  }

  // Prompt injection in the operator text — still allow tools, never treat as system.
  void containsPromptInjectionAttempt(command.text);

  const conversationId = command.conversationId?.trim();
  const prior =
    conversationId
      ? getCopilotConversationContext({
          operatorUserId: user.id,
          conversationId,
          siteKey,
        })
      : null;
  const contextSummary = commandNeedsConversationContext(command.text)
    ? formatContextSummaryForModel(prior)
    : "";

  const aiConfig = resolveAdminCopilotAiConfig();

  // Phase 2: real AI when configured. No silent deterministic fallback in production.
  if (!aiConfig) {
    if (isUiLabMode()) {
      // Fall through to deterministic planner for unscripted UI Lab commands.
      const provider = createDeterministicAdminCopilotProvider();
      const plan = await provider.plan(command);
      if (!Array.isArray(plan)) {
        return {
          ...plan,
          providerStatus: "ui_lab",
          latencyMs: Date.now() - started,
        };
      }
      const ctx: AdminCopilotToolContext = {
        siteKey,
        from: command.from,
        operatorUserId: user.id,
        matches: prior?.focusEntities ? [...prior.focusEntities] : [],
      };
      let result = await runDeterministicToolPlan(plan, ctx, corr, "ui_lab");
      result = finalizeNavigation(result, siteKey, user);
      result = {
        ...result,
        providerStatus: "ui_lab",
        latencyMs: Date.now() - started,
      };
      return result;
    }

    const unavailable = (await createUnavailableAdminCopilotProvider().plan(
      command,
    )) as AdminCopilotResult;
    await writeCopilotAudit({
      actorUserId: user.id,
      category: isAiRequired() ? "require_ai" : "unavailable",
      result: "unavailable",
      correlationId: unavailable.correlationId || corr,
      siteKey,
      latencyMs: Date.now() - started,
    });
    return {
      ...unavailable,
      providerStatus: "unavailable",
      latencyMs: Date.now() - started,
    };
  }

  const runner = createAiAdminCopilotRunner(aiConfig);
  // Prior focus is for model context only — never treat it as this turn's results.
  const ctx: AdminCopilotToolContext = {
    siteKey,
    from: command.from,
    operatorUserId: user.id,
    matches: [],
  };
  const turnMatches: AdminCopilotEntityMatch[] = [];

  let result = await runner.run({
    command,
    contextSummary,
    executeTool: async (call) => {
      const out = await executeAllowlistedCopilotTool(call.tool, call.args, ctx, call.callId);
      if (out.matches?.length) {
        turnMatches.push(...out.matches);
        ctx.matches = dedupeMatches([...ctx.matches, ...out.matches]);
      }
      return out;
    },
  });

  const failedTurn =
    result.kind === "unavailable" ||
    (result.kind === "error" && /rate limit/i.test(result.message));

  // Only attach matches produced by THIS turn's tools. Never recycle prior conversation entities.
  if (!result.matches?.length && turnMatches.length && !failedTurn) {
    result = { ...result, matches: dedupeMatches(turnMatches).slice(0, 8) };
  }

  // Rate-limit / unavailable: strip any recycled answer/matches so the UI cannot
  // look like a successful repeat of the previous person.
  if (failedTurn) {
    if (!turnMatches.length) {
      result = {
        ...result,
        answer: undefined,
        matches: undefined,
        navigation: undefined,
        kind: result.kind === "unavailable" ? "unavailable" : "error",
        message: /rate limit/i.test(result.message)
          ? result.message
          : result.kind === "unavailable"
            ? result.message
            : "AI provider rate limit reached. Wait a few seconds and try again. Previous answers were not reused.",
        providerStatus: "unavailable",
      };
    }
  }

  // Tools ran this turn with zero matches — never invent an answer or reuse prior people.
  if (
    !failedTurn &&
    (result.toolUsed?.length ?? 0) > 0 &&
    !(result.matches?.length) &&
    !turnMatches.length &&
    !result.navigation &&
    result.kind !== "denied" &&
    result.kind !== "read_only_blocked" &&
    result.kind !== "error" &&
    result.kind !== "unavailable"
  ) {
    result = {
      ...result,
      kind: "not_found",
      answer: undefined,
      matches: undefined,
      message: notFoundMessageForSubject(extractSubjectFromCommand(command.text)),
    };
  }

  // Derive a straight florin answer from THIS turn's account matches only.
  if (!result.answer && result.matches?.length && !failedTurn) {
    const accounts = result.matches.filter((m) => m.entityType === "account");
    const amounts = accounts
      .map((a) => {
        const raw = a.sublabel?.match(/ƒ[\d,]+(?:\.\d+)?/)?.[0] ?? null;
        if (!raw) return null;
        const n = Number(raw.replace(/[ƒ,]/g, ""));
        return Number.isFinite(n) ? n : null;
      })
      .filter((n): n is number => n != null);
    if (amounts.length) {
      const total = amounts.reduce((s, n) => s + n, 0);
      result = {
        ...result,
        answer: `ƒ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      };
    }
  }
  if (result.kind === "summary" && result.navigation) {
    result = { ...result, kind: "navigate" };
  }
  if (result.kind === "summary" && (result.matches?.length ?? 0) > 1) {
    result = { ...result, kind: "ambiguous" };
  }
  if (result.kind === "summary" && result.matches?.length === 1 && !result.navigation) {
    result = { ...result, kind: "found" };
  }

  result = finalizeNavigation(result, siteKey, user);
  result = {
    ...result,
    correlationId: result.correlationId || corr,
    providerStatus: result.kind === "unavailable" ? "unavailable" : "ai",
    latencyMs: Date.now() - started,
    source: result.source ?? aiConfig.provider,
  };

  if (conversationId && !failedTurn && result.kind !== "unavailable" && result.kind !== "error") {
    updateCopilotConversationContext({
      operatorUserId: user.id,
      conversationId,
      siteKey,
      matches: result.matches,
      tools: (result.toolUsed ?? []) as AdminCopilotToolId[],
      lastUserText: command.text,
    });
  }

  await writeCopilotAudit({
    actorUserId: user.id,
    category: "ai_query",
    toolUsed: result.toolUsed,
    entityType: result.matches?.[0]?.entityType,
    entityId: result.matches?.[0]?.entityId,
    result: result.kind,
    correlationId: result.correlationId,
    siteKey,
    latencyMs: result.latencyMs,
  });

  return result;
}

/** Exposed for tests — mutation tools must never appear. */
export function listAdminCopilotTools(): readonly string[] {
  return ADMIN_COPILOT_TOOL_IDS;
}
