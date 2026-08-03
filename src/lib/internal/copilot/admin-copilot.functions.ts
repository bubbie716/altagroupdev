import { createServerFn } from "@tanstack/react-start";
import type { AdminCopilotCommand, AdminCopilotResult } from "@/lib/internal/copilot/types";
import { createSafeNavigationIntent as buildSafeNav } from "@/lib/internal/copilot/navigation-safety";
import { validateNavigationIntent } from "@/lib/internal/copilot/navigation-safety";

export const runAdminCopilotCommandFn = createServerFn({ method: "POST" })
  .inputValidator((input: AdminCopilotCommand) => {
    if (!input || typeof input !== "object") throw new Error("BAD_REQUEST");
    if (typeof input.text !== "string" || input.text.trim().length === 0) {
      throw new Error("BAD_REQUEST:command_required");
    }
    if (input.text.length > 500) throw new Error("BAD_REQUEST:command_too_long");
    return {
      text: input.text.trim(),
      siteKey: typeof input.siteKey === "string" ? input.siteKey : "corporate",
      scenario: typeof input.scenario === "string" ? input.scenario : undefined,
      currentPath: typeof input.currentPath === "string" ? input.currentPath : undefined,
      from: typeof input.from === "string" ? input.from : undefined,
      conversationId:
        typeof input.conversationId === "string" && input.conversationId.trim()
          ? input.conversationId.trim().slice(0, 64)
          : undefined,
    } satisfies AdminCopilotCommand;
  })
  .handler(async ({ data }) => {
    const { runAdminCopilotCommand } = await import("@/server/copilot/admin-copilot.service");
    const result = await runAdminCopilotCommand(data);
    // Ensure JSON-serializable payload for TanStack Start
    return JSON.parse(JSON.stringify(result)) as AdminCopilotResult;
  });

/** Client chooses a match → server builds a validated navigation intent. */
export const createAdminCopilotNavigationFn = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      href: string;
      siteKey: string;
      entityType: string;
      entityId: string;
      reason?: string;
      from?: string;
    }) => input,
  )
  .handler(async ({ data }) => {
    const { requireAuth } = await import("@/server/auth.service");
    const { canAccessInternalForSite } = await import("@/lib/auth/permissions");
    const { getUiLabUserIfEnabled } = await import("@/lib/auth/ui-lab");
    const labUser = getUiLabUserIfEnabled();
    const user = labUser ?? (await requireAuth());
    const siteKey = data.siteKey as import("@/config/sites").SiteKey;
    if (!canAccessInternalForSite(user, siteKey)) {
      throw new Error("FORBIDDEN");
    }
    const intent = buildSafeNav({
      href: data.href,
      siteKey: data.siteKey,
      reason: data.reason ?? "Open record",
      entityType: data.entityType,
      entityId: data.entityId,
      from: data.from,
    });
    if (!intent) {
      return { ok: false as const, reason: "Invalid or external destination." };
    }
    const validated = validateNavigationIntent(intent, {
      siteKey,
      user,
    });
    if (!validated.ok) return { ok: false as const, reason: validated.reason };
    return {
      ok: true as const,
      intent: JSON.parse(JSON.stringify(validated.intent)) as typeof validated.intent,
    };
  });
