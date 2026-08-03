/**
 * Shared product Discord role management (Phase 5).
 * Bank Client / Terminal Investor / Secretary Staff — each bot owns only its role IDs.
 */

import { isDiscordLiveDeliveryDisabled } from "@/lib/discord/discord-delivery-guard";
import {
  assertRoleOwnedByBot,
  botTokenForProductRole,
  isDiscordRoleSyncEnabled,
  resolveProductRoleConfig,
  roleEventTypeForAction,
  type DiscordProductRoleKey,
  type DiscordRoleAction,
} from "@/lib/discord/discord-product-role";
import type { DiscordTargetBot } from "@/lib/discord/discord-event-envelope";
import { prisma } from "@/server/db";

export type RoleSyncResult =
  | {
      ok: true;
      action: DiscordRoleAction;
      productRole: DiscordProductRoleKey;
      changed: boolean;
      reason: string;
    }
  | {
      ok: false;
      action: DiscordRoleAction;
      productRole: DiscordProductRoleKey;
      reason: string;
      retryable?: boolean;
    };

function logRole(message: string, meta?: Record<string, unknown>): void {
  if (isDiscordLiveDeliveryDisabled()) return;
  console.info(`[discord-product-role] ${message}`, meta ?? {});
}

async function writeRoleAudit(input: {
  actorUserId?: string | null;
  altaUserId?: string | null;
  discordUserId: string;
  productRole: DiscordProductRoleKey;
  action: DiscordRoleAction;
  result: "ok" | "failed" | "skipped";
  reason: string;
  changed?: boolean;
}): Promise<void> {
  // AuditLog.actorUserId is required — skip when no actor (system join sync).
  if (!input.actorUserId && !input.altaUserId) return;
  try {
    const { writeAuditLog } = await import("@/server/audit.service");
    await writeAuditLog({
      actorUserId: input.actorUserId ?? input.altaUserId!,
      action: `DISCORD_ROLE_${input.action.toUpperCase()}`,
      entityType: "USER",
      entityId: input.altaUserId ?? input.discordUserId,
      targetUserId: input.altaUserId ?? undefined,
      description: `Discord ${input.productRole} ${input.action}: ${input.result}`,
      metadata: {
        productRole: input.productRole,
        action: input.action,
        result: input.result,
        reason: input.reason.slice(0, 200),
        changed: input.changed ?? false,
        discordUserId: input.discordUserId,
        source: "DISCORD_ROLE_SYNC",
      },
    });
  } catch {
    /* audit must not block role sync */
  }
}

/**
 * Bank client: linked Discord + not frozen + has opened at least one Alta Bank account.
 * Signup alone is not enough — Client role is granted on first bank account open.
 */
export async function isEligibleForBankClientRole(altaUserId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: altaUserId },
    select: { discordId: true, accountStatus: true },
  });
  if (!user?.discordId?.trim()) return false;
  if (String(user.accountStatus).toUpperCase() === "FROZEN") return false;

  const bankAccount = await prisma.bankAccount.findFirst({
    where: { userId: altaUserId },
    select: { id: true },
  });
  return Boolean(bankAccount);
}

/** Terminal investor: owns or created an ACTIVE Terminal portfolio. */
export async function isEligibleForTerminalInvestorRole(altaUserId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: altaUserId },
    select: { discordId: true, accountStatus: true },
  });
  if (!user?.discordId?.trim()) return false;
  if (String(user.accountStatus).toUpperCase() === "FROZEN") return false;

  const portfolio = await prisma.terminalPortfolio.findFirst({
    where: {
      status: "ACTIVE",
      OR: [{ ownerUserId: altaUserId }, { createdByUserId: altaUserId }],
    },
    select: { id: true },
  });
  return Boolean(portfolio);
}

/** Secretary staff: any admin UserTag (existing permission model). */
export async function isEligibleForSecretaryStaffRole(altaUserId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: altaUserId },
    select: {
      discordId: true,
      tags: { select: { tag: true } },
    },
  });
  if (!user?.discordId?.trim()) return false;
  return user.tags.some((row) =>
    ["CORPORATE_ADMIN", "BANK_ADMIN", "TERMINAL_ADMIN"].includes(row.tag),
  );
}

export async function isEligibleForProductRole(
  productRole: DiscordProductRoleKey,
  altaUserId: string,
): Promise<boolean> {
  if (productRole === "bank_client") return isEligibleForBankClientRole(altaUserId);
  if (productRole === "terminal_investor") return isEligibleForTerminalInvestorRole(altaUserId);
  return isEligibleForSecretaryStaffRole(altaUserId);
}

async function discordRoleRequest(input: {
  method: "PUT" | "DELETE" | "GET";
  guildId: string;
  botToken: string;
  discordUserId: string;
  roleId: string;
}): Promise<{ ok: boolean; status: number; reason?: string; retryable?: boolean }> {
  if (isDiscordLiveDeliveryDisabled()) {
    return { ok: false, status: 0, reason: "disabled_in_test" };
  }

  const url =
    input.method === "GET"
      ? `https://discord.com/api/v10/guilds/${input.guildId}/members/${input.discordUserId}`
      : `https://discord.com/api/v10/guilds/${input.guildId}/members/${input.discordUserId}/roles/${input.roleId}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: input.method,
      headers: {
        Authorization: `Bot ${input.botToken}`,
        ...(input.method === "PUT" ? { "Content-Length": "0" } : {}),
      },
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    return {
      ok: false,
      status: 0,
      reason: error instanceof Error ? error.message.slice(0, 200) : "network_error",
      retryable: true,
    };
  }

  if (response.ok || response.status === 204) return { ok: true, status: response.status };

  if (response.status === 404) {
    return { ok: false, status: 404, reason: "member_or_role_not_found", retryable: false };
  }
  if (response.status === 403) {
    return { ok: false, status: 403, reason: "forbidden_missing_permission", retryable: false };
  }
  if (response.status === 429) {
    return { ok: false, status: 429, reason: "rate_limited", retryable: true };
  }
  if (response.status >= 500) {
    return { ok: false, status: response.status, reason: `discord_api_${response.status}`, retryable: true };
  }

  const detail = await response.text().catch(() => "");
  return {
    ok: false,
    status: response.status,
    reason: detail.slice(0, 200) || `discord_api_${response.status}`,
    retryable: false,
  };
}

export async function memberHasGuildRole(input: {
  guildId: string;
  botToken: string;
  discordUserId: string;
  roleId: string;
}): Promise<{ ok: true; hasRole: boolean } | { ok: false; reason: string; retryable?: boolean }> {
  if (isDiscordLiveDeliveryDisabled()) {
    return { ok: false, reason: "disabled_in_test" };
  }

  const response = await fetch(
    `https://discord.com/api/v10/guilds/${input.guildId}/members/${input.discordUserId}`,
    {
      headers: { Authorization: `Bot ${input.botToken}` },
      signal: AbortSignal.timeout(8_000),
    },
  );

  if (response.status === 404) return { ok: true, hasRole: false };
  if (!response.ok) {
    if (response.status === 429) return { ok: false, reason: "rate_limited", retryable: true };
    if (response.status === 403) return { ok: false, reason: "forbidden_missing_permission" };
    return { ok: false, reason: `discord_api_${response.status}`, retryable: response.status >= 500 };
  }

  const data = (await response.json()) as { roles?: string[] };
  return { ok: true, hasRole: (data.roles ?? []).includes(input.roleId) };
}

export type ApplyProductRoleInput = {
  productRole: DiscordProductRoleKey;
  action: DiscordRoleAction;
  discordUserId: string;
  altaUserId?: string | null;
  actorUserId?: string | null;
  reason?: string;
  /** When set, worker must match this bot (cross-product refuse). */
  requiredTargetBot?: DiscordTargetBot;
  /** Reconcile: whether the member should have the role. */
  expectedHasRole?: boolean;
  /** Skip eligibility re-check (operator-confirmed mutate). */
  skipEligibilityCheck?: boolean;
};

/**
 * Apply a single product role change using only that product's bot token + guild + role ID.
 * Idempotent: granting an existing role or revoking a missing role is success with changed=false.
 */
export async function applyDiscordProductRole(
  input: ApplyProductRoleInput,
): Promise<RoleSyncResult> {
  const { productRole, action } = input;
  const discordUserId = input.discordUserId.trim();
  if (!discordUserId) {
    return { ok: false, action, productRole, reason: "discord_user_missing" };
  }

  const config = resolveProductRoleConfig(productRole);
  if (!config) {
    return { ok: false, action, productRole, reason: "role_or_guild_not_configured" };
  }

  if (input.requiredTargetBot) {
    const ownership = assertRoleOwnedByBot(productRole, input.requiredTargetBot);
    if (!ownership.ok) {
      return { ok: false, action, productRole, reason: ownership.reason };
    }
  }

  const botToken = botTokenForProductRole(config);
  if (!botToken) {
    return { ok: false, action, productRole, reason: "bot_token_not_configured" };
  }

  // Fail closed: never use a different product's guild.
  const expectedGuild =
    productRole === "bank_client"
      ? process.env.DISCORD_BANK_GUILD_ID?.trim()
      : productRole === "terminal_investor"
        ? process.env.DISCORD_TERMINAL_GUILD_ID?.trim()
        : process.env.DISCORD_SECRETARY_GUILD_ID?.trim();
  if (!expectedGuild || expectedGuild !== config.guildId) {
    return { ok: false, action, productRole, reason: "wrong_guild_configuration" };
  }

  let shouldHaveRole: boolean;
  if (action === "grant") {
    shouldHaveRole = true;
  } else if (action === "revoke") {
    shouldHaveRole = false;
  } else {
    shouldHaveRole = Boolean(input.expectedHasRole);
  }

  if (!input.skipEligibilityCheck && input.altaUserId) {
    const eligible = await isEligibleForProductRole(productRole, input.altaUserId);
    if (action === "grant" && !eligible) {
      await writeRoleAudit({
        ...input,
        discordUserId,
        result: "skipped",
        reason: "not_eligible",
      });
      return { ok: false, action, productRole, reason: "not_eligible" };
    }
    if (action === "revoke" && eligible) {
      // Conservative: do not revoke while still eligible.
      await writeRoleAudit({
        ...input,
        discordUserId,
        result: "skipped",
        reason: "still_eligible_revoke_refused",
      });
      return {
        ok: true,
        action,
        productRole,
        changed: false,
        reason: "still_eligible_revoke_refused",
      };
    }
    if (action === "reconcile") {
      shouldHaveRole = eligible;
    }
  }

  const current = await memberHasGuildRole({
    guildId: config.guildId,
    botToken,
    discordUserId,
    roleId: config.roleId,
  });
  if (!current.ok) {
    await writeRoleAudit({
      ...input,
      discordUserId,
      result: "failed",
      reason: current.reason,
    });
    return {
      ok: false,
      action,
      productRole,
      reason: current.reason,
      retryable: current.retryable,
    };
  }

  if (current.hasRole === shouldHaveRole) {
    await writeRoleAudit({
      ...input,
      discordUserId,
      result: "ok",
      reason: "idempotent_noop",
      changed: false,
    });
    return {
      ok: true,
      action,
      productRole,
      changed: false,
      reason: "idempotent_noop",
    };
  }

  const method = shouldHaveRole ? "PUT" : "DELETE";
  // Conservative revoke policy: only DELETE when explicitly revoking or reconcile says absent.
  if (method === "DELETE" && action === "grant") {
    return { ok: false, action, productRole, reason: "invalid_grant_delete" };
  }

  const api = await discordRoleRequest({
    method,
    guildId: config.guildId,
    botToken,
    discordUserId,
    roleId: config.roleId,
  });

  if (!api.ok) {
    // Discord returns 204 for role already present on PUT in some cases; treat 204/ok above.
    // If member not in guild on grant — not retryable as success path.
    await writeRoleAudit({
      ...input,
      discordUserId,
      result: "failed",
      reason: api.reason ?? "discord_api_error",
    });
    return {
      ok: false,
      action,
      productRole,
      reason: api.reason ?? "discord_api_error",
      retryable: api.retryable,
    };
  }

  logRole("role applied", {
    productRole,
    action,
    discordUserId,
    changed: true,
  });

  await writeRoleAudit({
    ...input,
    discordUserId,
    result: "ok",
    reason: input.reason ?? `${action}_applied`,
    changed: true,
  });

  return {
    ok: true,
    action,
    productRole,
    changed: true,
    reason: input.reason ?? `${action}_applied`,
  };
}

/** Enqueue a durable role_mgmt outbox row (when dual-write + role sync enabled). */
export async function enqueueDiscordRoleSyncEvent(input: {
  productRole: DiscordProductRoleKey;
  action: DiscordRoleAction;
  discordUserId: string;
  altaUserId?: string | null;
  actorUserId?: string | null;
  reason?: string;
  expectedHasRole?: boolean;
  /** Override default user/action key (e.g. portfolio activation). */
  idempotencyKeySuffix?: string;
}): Promise<string | null> {
  if (!isDiscordRoleSyncEnabled()) return null;

  const config = resolveProductRoleConfig(input.productRole);
  if (!config) return null;

  const { enqueueDiscordFanout } = await import(
    "@/server/discord-outbox.service"
  );
  const {
    resolveOutboxTargetBot,
    buildStaffAuditIdempotencyKey,
  } = await import("@/lib/discord/discord-event-envelope");
  const { buildSecretaryCentralAuditDisplayPayload } = await import(
    "@/lib/discord/discord-secretary-audit-fanout"
  );

  const eventType = roleEventTypeForAction(input.productRole, input.action);
  const baseKey = `role:${input.productRole}:${input.action}:${input.discordUserId}:${input.altaUserId ?? "na"}`;
  const idempotencyKey = buildStaffAuditIdempotencyKey(
    input.idempotencyKeySuffix
      ? `${baseKey}:${input.idempotencyKeySuffix}`
      : baseKey,
    eventType,
  );

  const productTargetBot = resolveOutboxTargetBot({
    product: config.product,
    channelClass: "role_mgmt",
    eventType,
  });

  const displayPayload = {
    kind: "role_mgmt" as const,
    action: input.action,
    productRole: input.productRole,
    discordUserId: input.discordUserId,
    roleId: config.roleId,
    altaUserId: input.altaUserId ?? undefined,
    reason: input.reason,
    expectedHasRole: input.expectedHasRole,
  };

  const result = await enqueueDiscordFanout({
    baseIdempotencyKey: idempotencyKey,
    product: config.product,
    eventType,
    channelClass: "role_mgmt",
    productTargetBot,
    displayPayload,
    secretaryAuditPayload: buildSecretaryCentralAuditDisplayPayload({
      originalProduct: config.product,
      eventType,
      action: eventType,
      severity: "ACTION",
      actorLabel: input.actorUserId ?? undefined,
      entityType: "DISCORD_USER",
      entityId: input.discordUserId,
      correlationId: idempotencyKey,
      originalDestinationBot: productTargetBot,
      originalChannelClass: "role_mgmt",
      roleMgmt: {
        productRole: input.productRole,
        action: input.action,
        reason: input.reason,
      },
    }),
    severity: "ACTION",
    actor: input.actorUserId ? { userId: input.actorUserId } : undefined,
    subject: {
      userId: input.altaUserId ?? undefined,
      entityType: "DISCORD_USER",
      entityId: input.discordUserId,
    },
    internalRef: {
      entityType: "DISCORD_ROLE",
      entityId: input.discordUserId,
      auditAction: eventType,
    },
    deliveryPolicy: "queued",
  });

  // Keep return shape: product destination outbox id (legacy callers).
  return result.destinations.find((d) => d.role === "product")?.outboxId ?? null;
}

/**
 * After a Terminal portfolio becomes ACTIVE: grant Investor immediately.
 * Does not depend on cron. Optional outbox row is marked SENT when apply succeeds.
 * Never mutates Discord inside the financial transaction — call after commit.
 */
export async function enqueueTerminalInvestorRoleGrantAfterActivation(input: {
  altaUserId: string;
  portfolioId: string;
  actorUserId?: string | null;
  reason?: string;
}): Promise<{
  enqueued: boolean;
  applied: boolean;
  reason: string;
  outboxId?: string | null;
}> {
  const user = await prisma.user.findUnique({
    where: { id: input.altaUserId },
    select: { id: true, discordId: true, accountStatus: true },
  });
  if (!user?.discordId?.trim()) {
    return { enqueued: false, applied: false, reason: "discord_identity_missing" };
  }
  if (String(user.accountStatus).toUpperCase() === "FROZEN") {
    return { enqueued: false, applied: false, reason: "account_frozen" };
  }

  const portfolio = await prisma.terminalPortfolio.findFirst({
    where: {
      id: input.portfolioId,
      status: "ACTIVE",
      OR: [{ ownerUserId: input.altaUserId }, { createdByUserId: input.altaUserId }],
    },
    select: { id: true, status: true },
  });
  if (!portfolio) {
    return { enqueued: false, applied: false, reason: "portfolio_not_active_or_unauthorized" };
  }

  const eligible = await isEligibleForTerminalInvestorRole(input.altaUserId);
  if (!eligible) {
    return { enqueued: false, applied: false, reason: "not_eligible" };
  }

  const reason = input.reason ?? "terminal_portfolio_activated";

  // Immediate grant on portfolio creation — not queued behind cron.
  const applyResult = await applyDiscordProductRole({
    productRole: "terminal_investor",
    action: "grant",
    discordUserId: user.discordId,
    altaUserId: input.altaUserId,
    actorUserId: input.actorUserId ?? input.altaUserId,
    reason,
    requiredTargetBot: "terminal",
    expectedHasRole: true,
  });

  let outboxId: string | null = null;
  if (isDiscordRoleSyncEnabled()) {
    outboxId = await enqueueDiscordRoleSyncEvent({
      productRole: "terminal_investor",
      action: "grant",
      discordUserId: user.discordId,
      altaUserId: input.altaUserId,
      actorUserId: input.actorUserId ?? input.altaUserId,
      reason,
      expectedHasRole: true,
      idempotencyKeySuffix: `portfolio:${input.portfolioId}:activation`,
    });
    if (applyResult.ok && outboxId) {
      try {
        const { markDiscordOutboxSent, resolveProductOutboxIdempotencyKey } = await import(
          "@/server/discord-outbox.service"
        );
        const { buildStaffAuditIdempotencyKey } = await import(
          "@/lib/discord/discord-event-envelope"
        );
        const eventType = roleEventTypeForAction("terminal_investor", "grant");
        const baseKey = buildStaffAuditIdempotencyKey(
          `role:terminal_investor:grant:${user.discordId}:${input.altaUserId}:portfolio:${input.portfolioId}:activation`,
          eventType,
        );
        await markDiscordOutboxSent(resolveProductOutboxIdempotencyKey(baseKey, "terminal"));
      } catch {
        /* best-effort */
      }
    }
  }

  if (!applyResult.ok) {
    logRole("terminal investor grant after activation failed", {
      reason: applyResult.reason,
      altaUserId: input.altaUserId,
      portfolioId: input.portfolioId,
    });
  }

  return {
    enqueued: Boolean(outboxId),
    applied: applyResult.ok,
    reason: applyResult.ok ? "applied" : applyResult.reason,
    outboxId,
  };
}

/**
 * When eligibility is lost (e.g. last ACTIVE portfolio archived): audit a pending
 * reconcile — never auto-revoke. Operators use explicit Reconcile to revoke.
 */
export async function surfaceTerminalInvestorIneligibilityPendingReconcile(input: {
  altaUserId: string;
  portfolioId?: string | null;
  actorUserId?: string | null;
  reason?: string;
}): Promise<void> {
  const eligible = await isEligibleForTerminalInvestorRole(input.altaUserId);
  if (eligible) return;

  const user = await prisma.user.findUnique({
    where: { id: input.altaUserId },
    select: { discordId: true },
  });
  if (!user?.discordId?.trim()) return;

  await writeRoleAudit({
    actorUserId: input.actorUserId ?? input.altaUserId,
    altaUserId: input.altaUserId,
    discordUserId: user.discordId,
    productRole: "terminal_investor",
    action: "reconcile",
    result: "skipped",
    reason: input.reason ?? "pending_ineligible_reconcile",
    changed: false,
  });
}

/**
 * Best-effort grant for Bank client — immediate Discord apply (not cron).
 * Optional outbox row is recorded then marked SENT when apply already succeeded.
 */
export async function grantBankClientRoleBestEffort(discordUserId: string, altaUserId?: string): Promise<void> {
  const result = await applyDiscordProductRole({
    productRole: "bank_client",
    action: "grant",
    discordUserId,
    altaUserId,
    reason: "bank_account_opened",
    requiredTargetBot: "bank",
    skipEligibilityCheck: !altaUserId,
  });
  if (isDiscordRoleSyncEnabled()) {
    const outboxId = await enqueueDiscordRoleSyncEvent({
      productRole: "bank_client",
      action: "grant",
      discordUserId,
      altaUserId,
      reason: "bank_account_opened",
      expectedHasRole: true,
    });
    if (result.ok && outboxId) {
      try {
        const { markDiscordOutboxSent, resolveProductOutboxIdempotencyKey } = await import(
          "@/server/discord-outbox.service"
        );
        const { buildStaffAuditIdempotencyKey } = await import(
          "@/lib/discord/discord-event-envelope"
        );
        const eventType = roleEventTypeForAction("bank_client", "grant");
        const baseKey = buildStaffAuditIdempotencyKey(
          `role:bank_client:grant:${discordUserId}:${altaUserId ?? "na"}`,
          eventType,
        );
        await markDiscordOutboxSent(resolveProductOutboxIdempotencyKey(baseKey, "bank"));
      } catch {
        /* best-effort */
      }
    }
  }
  if (!result.ok && result.reason !== "role_or_guild_not_configured" && result.reason !== "disabled_in_test") {
    logRole("bank client grant failed", { reason: result.reason });
  }
}

export async function syncProductRoleForUserBestEffort(input: {
  productRole: DiscordProductRoleKey;
  altaUserId: string;
  actorUserId?: string | null;
  preferRevokeWhenIneligible?: boolean;
}): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: input.altaUserId },
    select: { discordId: true },
  });
  if (!user?.discordId) return;

  const eligible = await isEligibleForProductRole(input.productRole, input.altaUserId);
  const action: DiscordRoleAction = eligible
    ? "grant"
    : input.preferRevokeWhenIneligible
      ? "revoke"
      : "reconcile";

  if (!eligible && !input.preferRevokeWhenIneligible) {
    // Conservative: do not remove roles unless explicitly requested.
    return;
  }

  await applyDiscordProductRole({
    productRole: input.productRole,
    action: eligible ? "grant" : "revoke",
    discordUserId: user.discordId,
    altaUserId: input.altaUserId,
    actorUserId: input.actorUserId,
    reason: `${input.productRole}_${action}`,
    expectedHasRole: eligible,
  });

  if (isDiscordRoleSyncEnabled()) {
    await enqueueDiscordRoleSyncEvent({
      productRole: input.productRole,
      action: eligible ? "grant" : "revoke",
      discordUserId: user.discordId,
      altaUserId: input.altaUserId,
      actorUserId: input.actorUserId,
      reason: `${input.productRole}_${action}`,
      expectedHasRole: eligible,
    });
  }
}

export type DiscordRoleOutboxState = {
  status: "PENDING" | "PROCESSING" | "FAILED" | "DEAD" | "SENT" | null;
  retryCount: number | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  outboxId: string | null;
  idempotencyKey: string | null;
};

export type DiscordRoleReconciliationSnapshot = {
  altaUserId: string;
  discordId: string | null;
  discordUsername: string | null;
  roles: Array<{
    productRole: DiscordProductRoleKey;
    label: string;
    ownerBot: DiscordTargetBot;
    configured: boolean;
    /** Eligibility result — whether the user should have the role. */
    expected: boolean;
    eligibilityLabel: string;
    lastAuditAction: string | null;
    lastAuditReason: string | null;
    lastAuditAt: string | null;
    lastSyncAttemptAt: string | null;
    lastSyncSuccessAt: string | null;
    lastSyncFailureAt: string | null;
    lastFailureReason: string | null;
    outbox: DiscordRoleOutboxState;
    /**
     * Live Discord member role presence. Null when not fetched / unavailable —
     * never invent "has role" / "missing" when the bot cannot safely read it.
     */
    liveHasRole: boolean | null;
    liveRoleStateAvailable: boolean;
    liveRoleStateReason: string | null;
  }>;
  roleSyncEnabled: boolean;
};

function eligibilityLabel(expected: boolean, hasDiscord: boolean): string {
  if (!hasDiscord) return "ineligible — Discord unlinked";
  return expected ? "eligible — should have role" : "ineligible — should not have role";
}

/** Operator reconciliation view — no live Discord mutation by default. */
export async function getDiscordRoleReconciliationSnapshot(
  altaUserId: string,
  options?: { fetchLiveRoles?: boolean },
): Promise<DiscordRoleReconciliationSnapshot | null> {
  const user = await prisma.user.findUnique({
    where: { id: altaUserId },
    select: { id: true, discordId: true, discordUsername: true },
  });
  if (!user) return null;

  const keys: DiscordProductRoleKey[] = ["bank_client", "terminal_investor", "secretary_staff"];
  const roles: DiscordRoleReconciliationSnapshot["roles"] = [];
  const fetchLive = Boolean(options?.fetchLiveRoles) && Boolean(user.discordId?.trim());

  for (const productRole of keys) {
    const config = resolveProductRoleConfig(productRole);
    const ownerBot: DiscordTargetBot =
      productRole === "bank_client"
        ? "bank"
        : productRole === "terminal_investor"
          ? "terminal"
          : "secretary";
    const expected = user.discordId
      ? await isEligibleForProductRole(productRole, altaUserId)
      : false;

    let lastAuditAction: string | null = null;
    let lastAuditReason: string | null = null;
    let lastAuditAt: string | null = null;
    let lastSyncAttemptAt: string | null = null;
    let lastSyncSuccessAt: string | null = null;
    let lastSyncFailureAt: string | null = null;
    let lastFailureReason: string | null = null;
    try {
      const audits = await prisma.auditLog.findMany({
        where: {
          targetUserId: altaUserId,
          action: { startsWith: "DISCORD_ROLE_" },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { action: true, description: true, createdAt: true, metadata: true },
      });
      for (const row of audits) {
        const meta = row.metadata as {
          productRole?: string;
          reason?: string;
          result?: string;
        } | null;
        if (meta?.productRole !== productRole) continue;
        if (!lastAuditAction) {
          lastAuditAction = row.action;
          lastAuditReason = meta?.reason ?? row.description;
          lastAuditAt = row.createdAt.toISOString();
          lastSyncAttemptAt = lastAuditAt;
        }
        if (!lastSyncSuccessAt && meta?.result === "ok") {
          lastSyncSuccessAt = row.createdAt.toISOString();
        }
        if (!lastSyncFailureAt && meta?.result === "failed") {
          lastSyncFailureAt = row.createdAt.toISOString();
          lastFailureReason = meta?.reason ?? row.description;
        }
      }
    } catch {
      /* ignore */
    }

    const outbox: DiscordRoleOutboxState = {
      status: null,
      retryCount: null,
      lastAttemptAt: null,
      lastError: null,
      outboxId: null,
      idempotencyKey: null,
    };
    try {
      const eventPrefix =
        productRole === "bank_client"
          ? "BANK_CLIENT_ROLE_"
          : productRole === "terminal_investor"
            ? "TERMINAL_INVESTOR_ROLE_"
            : "SECRETARY_STAFF_ROLE_";
      const row = await prisma.discordOutbox.findFirst({
        where: {
          channelClass: "role_mgmt",
          eventType: { startsWith: eventPrefix },
          ...(user.discordId
            ? { idempotencyKey: { contains: user.discordId } }
            : { idempotencyKey: { contains: altaUserId } }),
        },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          status: true,
          attempts: true,
          lastError: true,
          idempotencyKey: true,
          updatedAt: true,
          deliveredAt: true,
        },
      });
      if (row) {
        outbox.status = row.status as DiscordRoleOutboxState["status"];
        outbox.retryCount = row.attempts;
        outbox.lastAttemptAt = row.updatedAt.toISOString();
        outbox.lastError = row.lastError;
        outbox.outboxId = row.id;
        outbox.idempotencyKey = row.idempotencyKey;
        if (!lastFailureReason && row.lastError) lastFailureReason = row.lastError;
        if (!lastSyncSuccessAt && row.deliveredAt) {
          lastSyncSuccessAt = row.deliveredAt.toISOString();
        }
      }
    } catch {
      /* outbox table may be unavailable */
    }

    let liveHasRole: boolean | null = null;
    let liveRoleStateAvailable = false;
    let liveRoleStateReason: string | null = "live_member_roles_unavailable";
    if (!fetchLive) {
      liveRoleStateReason = "live_member_roles_not_fetched";
    } else if (!config) {
      liveRoleStateReason = "role_or_guild_not_configured";
    } else if (isDiscordLiveDeliveryDisabled()) {
      liveRoleStateReason = "live_member_roles_unavailable";
    } else {
      const botToken = botTokenForProductRole(config);
      if (!botToken || !user.discordId) {
        liveRoleStateReason = "live_member_roles_unavailable";
      } else {
        const live = await memberHasGuildRole({
          guildId: config.guildId,
          botToken,
          discordUserId: user.discordId,
          roleId: config.roleId,
        });
        if (live.ok) {
          liveHasRole = live.hasRole;
          liveRoleStateAvailable = true;
          liveRoleStateReason = null;
        } else {
          liveRoleStateReason = live.reason || "live_member_roles_unavailable";
        }
      }
    }

    roles.push({
      productRole,
      label: config?.label ?? productRole,
      ownerBot,
      configured: Boolean(config),
      expected,
      eligibilityLabel: eligibilityLabel(expected, Boolean(user.discordId)),
      lastAuditAction,
      lastAuditReason,
      lastAuditAt,
      lastSyncAttemptAt,
      lastSyncSuccessAt,
      lastSyncFailureAt,
      lastFailureReason,
      outbox,
      liveHasRole,
      liveRoleStateAvailable,
      liveRoleStateReason,
    });
  }

  return {
    altaUserId: user.id,
    discordId: user.discordId,
    discordUsername: user.discordUsername,
    roles,
    roleSyncEnabled: isDiscordRoleSyncEnabled(),
  };
}
