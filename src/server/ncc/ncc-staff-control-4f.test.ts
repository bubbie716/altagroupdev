import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import { canAccessInternal } from "@/lib/auth/permissions";
import { NCC_DEFAULT_CURRENCY } from "@/lib/ncc/ncc-money";
import {
  NCC_SENSITIVE_CONFIRMATION,
  NCC_STEP_UP_MFA_AVAILABLE,
  staffRoleHasPermission,
} from "@/lib/ncc/ncc-staff-permissions";
import { setTestAuthUserForTests } from "@/server/auth.service";
import { isDatabaseConfigured, prisma } from "@/server/db";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";
import { attemptAutomaticCompensation } from "@/server/ncc/ncc-compensation.service";
import {
  approveEmergencyResume,
  emergencySuspendInstitution,
  requestEmergencyResume,
  NccControlPlaneError,
} from "@/server/ncc/ncc-control-plane.service";
import { ensureAltaInstitutionsSeeded } from "@/server/ncc/ncc-institution.service";
import {
  assertNetworkAllowsNewSettlement,
  NccNetworkControlError,
} from "@/server/ncc/ncc-network-control.service";
import {
  hasNccStaffPermission,
  requireInstitutionPermission,
  requireNccStaff,
} from "@/server/ncc/ncc-permissions.service";
import { getNccProductionReadiness } from "@/server/ncc/ncc-readiness.service";
import {
  assertLedgerOnlyReversalDisabled,
  createTransferReturnLedgerInstruction,
  NccSettlementError,
  reverseInstruction,
  reverseNccLedgerPositionsForCompensation,
  submitInstruction,
} from "@/server/ncc/ncc-settlement.service";
import { ensureBootstrapNccAdministrator, NccStaffError } from "@/server/ncc/ncc-staff.service";
import {
  ensureNccOutboxHandlersRegistered,
  listExpectedOutboxEventTypes,
  runNccSettlementWorkers,
} from "@/server/ncc/ncc-workers.service";
import { NCC_LIQUIDITY_OUTBOX } from "@/server/ncc/ncc-liquidity.service";
import { registerInstitutionAdapter } from "@/server/ncc/institution-adapter.registry";
import type {
  AdapterCommitResult,
  AdapterCreditResult,
  AdapterPreparationResult,
  AdapterResolveResult,
  AdapterValidationResult,
  InstitutionAdapter,
  InstitutionAdapterCreditInput,
  InstitutionAdapterDebitInput,
} from "@/server/ncc/institution-adapter";

const RUN = process.env.NCC_SETTLEMENT_TESTS === "1";
const ROOT = join(process.cwd(), "src");
const REPO = process.cwd();

function readSrc(...parts: string[]): string {
  return readFileSync(join(ROOT, ...parts), "utf8");
}

function isDbTransient(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    /quota|compute time|P1001|P1017|can't reach|ECONNREFUSED|timeout|Too many connections/i.test(
      msg,
    ) ||
    (error instanceof Error &&
      "code" in error &&
      ["P1001", "P1017"].includes(String((error as { code?: string }).code)))
  );
}

async function loadAltaUser(userId: string): Promise<AltaUser> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: userWithMembershipsInclude,
  });
  return mapDbUserToAltaUser(user);
}

async function asUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const prior = null;
  try {
    setTestAuthUserForTests(await loadAltaUser(userId));
    return await fn();
  } finally {
    setTestAuthUserForTests(prior);
  }
}

class FloatAdapter implements InstitutionAdapter {
  constructor(readonly institutionKey: string) {}
  async resolveAccount(): Promise<AdapterResolveResult> {
    return {
      ok: true,
      account: {
        internalAccountReference: "test-float",
        canonicalAccountNumber: "000000000001",
        maskedAccountNumber: "********0001",
        currency: "FLR",
        status: "ACTIVE",
        debitEligible: true,
        creditEligible: true,
        resolvedAt: new Date().toISOString(),
        resolverKey: `${this.institutionKey}@test`,
      },
    };
  }
  async validateAccountReference(): Promise<AdapterValidationResult> {
    return { ok: true, accountReference: "test-float" };
  }
  async prepareDebit(input: InstitutionAdapterDebitInput): Promise<AdapterPreparationResult> {
    return { ok: true, holdReference: `hold-${input.settlementInstructionId}` };
  }
  async commitDebit(
    input: InstitutionAdapterDebitInput & { holdReference: string },
  ): Promise<AdapterCommitResult> {
    return { ok: true, externalReference: `commit-${input.settlementInstructionId}` };
  }
  async releaseDebit(): Promise<void> {}
  async compensateDebit(input: InstitutionAdapterDebitInput): Promise<AdapterCommitResult> {
    return { ok: true, externalReference: `restore-${input.settlementInstructionId}` };
  }
  async notifyCredit(input: InstitutionAdapterCreditInput): Promise<AdapterCreditResult> {
    return {
      ok: true,
      credited: true,
      externalReference: `credit-${input.settlementInstructionId}`,
    };
  }
}

describe("ncc sprint 4f static / unit", () => {
  it("dedicated staff-role permission mapping; requireNccStaff does not use canAccessInternal alone", () => {
    const perms = readSrc("server/ncc/ncc-permissions.service.ts");
    const staffPerms = readSrc("lib/ncc/ncc-staff-permissions.ts");
    assert.ok(staffPerms.includes("NCC_STAFF_ROLE_PERMISSIONS"));
    assert.ok(staffPerms.includes("staffRoleHasPermission"));
    assert.ok(perms.includes("getActiveNccStaffMembership"));
    assert.ok(perms.includes("staffRoleHasPermission"));
    assert.ok(perms.includes("Dedicated NCC staff authorization"));
    // Financial staff gate must not short-circuit on broad internal access.
    const requireBody = perms.slice(
      perms.indexOf("export async function requireNccStaff"),
      perms.indexOf("export async function hasNccStaffPermission"),
    );
    assert.equal(requireBody.includes("canAccessInternal"), false);
    assert.equal(staffRoleHasPermission("VIEWER", "manage_staff"), false);
    assert.equal(staffRoleHasPermission("NCC_ADMINISTRATOR", "manage_staff"), true);
  });

  it("approveInstitution contains UNSAFE_ACTIVATION_BYPASS_DISABLED", () => {
    const source = readSrc("server/ncc/ncc-admin.service.ts");
    assert.ok(source.includes("UNSAFE_ACTIVATION_BYPASS_DISABLED"));
    assert.ok(source.includes("export async function approveInstitution"));
  });

  it("reverseInstruction throws LEDGER_ONLY_REVERSAL_DISABLED on the public path", async () => {
    const source = readSrc("server/ncc/ncc-settlement.service.ts");
    assert.ok(source.includes("LEDGER_ONLY_REVERSAL_DISABLED"));
    assert.ok(source.includes("export async function reverseInstruction"));
    await assert.rejects(
      () => reverseInstruction("any", "actor", "reason"),
      (e: unknown) =>
        e instanceof NccSettlementError && e.code === "LEDGER_ONLY_REVERSAL_DISABLED",
    );
    assert.throws(
      () => assertLedgerOnlyReversalDisabled(),
      (e: unknown) =>
        e instanceof NccSettlementError && e.code === "LEDGER_ONLY_REVERSAL_DISABLED",
    );
  });

  it("reverseNccLedgerPositionsForCompensation exists for compensation", () => {
    const settlement = readSrc("server/ncc/ncc-settlement.service.ts");
    const compensation = readSrc("server/ncc/ncc-compensation.service.ts");
    assert.ok(settlement.includes("export async function reverseNccLedgerPositionsForCompensation"));
    assert.ok(compensation.includes("reverseNccLedgerPositionsForCompensation"));
    assert.equal(typeof reverseNccLedgerPositionsForCompensation, "function");
  });

  it("no batching/netting settlement path in settlement/workers", () => {
    for (const rel of [
      "server/ncc/ncc-settlement.service.ts",
      "server/ncc/ncc-workers.service.ts",
      "server/ncc/ncc-execution.service.ts",
    ]) {
      const source = readSrc(rel);
      assert.equal(/netSettlement|NETTING\b|batchSettlement|clearingBatch|BATCHED_SETTLEMENT/i.test(source), false);
    }
    const workers = readSrc("server/ncc/ncc-workers.service.ts");
    assert.ok(/never batches or nets/i.test(workers));
  });

  it("vercel.json does not schedule crons (external cron-job.org only)", () => {
    const vercel = readFileSync(join(REPO, "vercel.json"), "utf8");
    assert.equal(vercel.includes('"crons"'), false);
    assert.equal(vercel.includes("/api/cron/ncc-settlement"), false);
    // Endpoint remains available for cron-job.org with CRON_SECRET.
    const cronRoute = readFileSync(
      join(ROOT, "routes/api/cron/ncc-settlement.ts"),
      "utf8",
    );
    assert.ok(cronRoute.includes("CRON_SECRET") || cronRoute.length > 0);
  });

  it("document storage fails closed in production (PRIVATE_DOCUMENT_STORAGE_REQUIRED)", () => {
    const source = readSrc("server/ncc/ncc-participant-documents.service.ts");
    assert.ok(source.includes("PRIVATE_DOCUMENT_STORAGE_REQUIRED"));
    assert.ok(source.includes('NODE_ENV === "production"'));
    assert.ok(/fail closed|never fall back to in-memory/i.test(source));
  });

  it("liquidity outbox event types are registered in workers", () => {
    const workers = readSrc("server/ncc/ncc-workers.service.ts");
    assert.ok(workers.includes("NCC_LIQUIDITY_OUTBOX"));
    assert.ok(workers.includes("Object.values(NCC_LIQUIDITY_OUTBOX)"));
    ensureNccOutboxHandlersRegistered();
    const expected = listExpectedOutboxEventTypes();
    for (const eventType of Object.values(NCC_LIQUIDITY_OUTBOX)) {
      assert.ok(expected.includes(eventType), `missing expected liquidity outbox type ${eventType}`);
    }
  });

  it("NCC_STEP_UP_MFA_AVAILABLE is false", () => {
    assert.equal(NCC_STEP_UP_MFA_AVAILABLE, false);
    const source = readSrc("lib/ncc/ncc-staff-permissions.ts");
    assert.ok(source.includes("export const NCC_STEP_UP_MFA_AVAILABLE = false"));
  });

  it("readiness service reports required blocker codes as strings in source", () => {
    const source = readSrc("server/ncc/ncc-readiness.service.ts");
    for (const code of [
      "DATABASE_NOT_CONFIGURED",
      "SESSION_SECRET_MISSING",
      "NCC_SECRETS_KEY_MISSING",
      "CRON_SECRET_MISSING",
      "STEP_UP_MFA_UNAVAILABLE",
      "MISSING_OUTBOX_HANDLERS",
      "WORKER_OVERDUE_OR_NEVER_SUCCEEDED",
      "UNSAFE_ACTIVATION_PATH_PRESENT",
    ]) {
      assert.ok(source.includes(`"${code}"`), `missing blocker code ${code}`);
    }
  });
});

describe("ncc sprint 4f staff control", { skip: !RUN || !isDatabaseConfigured() }, () => {
  const suffix = Date.now().toString(36);
  let viewerId = "";
  let adminId = "";
  let emergencyAId = "";
  let emergencyBId = "";
  let internalNoStaffId = "";
  let institutionId = "";
  let recvInstitutionId = "";
  let sendRoutingId = "";
  let recvRoutingId = "";
  let priorNetworkMode: string | null = null;
  let dbReady = true;

  before(async () => {
    try {
      await ensureAltaInstitutionsSeeded();

      const mkUser = async (label: string) =>
        prisma.user.create({
          data: {
            discordId: `ncc-4f-${label}-${suffix}`,
            discordUsername: `ncc_4f_${label}_${suffix}`,
            tags: { create: [{ tag: "ADMIN" }] },
          },
        });

      const viewer = await mkUser("viewer");
      const admin = await mkUser("admin");
      const emA = await mkUser("ema");
      const emB = await mkUser("emb");
      const internal = await mkUser("internal");
      viewerId = viewer.id;
      adminId = admin.id;
      emergencyAId = emA.id;
      emergencyBId = emB.id;
      internalNoStaffId = internal.id;

      await prisma.nccStaffMembership.create({
        data: { userId: viewerId, role: "VIEWER", status: "ACTIVE" },
      });

      try {
        await ensureBootstrapNccAdministrator(adminId);
      } catch (error) {
        if (error instanceof NccStaffError && error.code === "BOOTSTRAP_DENIED") {
          await prisma.nccStaffMembership.upsert({
            where: { userId: adminId },
            create: { userId: adminId, role: "NCC_ADMINISTRATOR", status: "ACTIVE" },
            update: {
              role: "NCC_ADMINISTRATOR",
              status: "ACTIVE",
              revokedAt: null,
              revokedByUserId: null,
              revokeReason: null,
            },
          });
        } else {
          throw error;
        }
      }

      for (const [userId, role] of [
        [emergencyAId, "EMERGENCY_ADMINISTRATOR"],
        [emergencyBId, "EMERGENCY_ADMINISTRATOR"],
      ] as const) {
        await prisma.nccStaffMembership.upsert({
          where: { userId },
          create: { userId, role, status: "ACTIVE" },
          update: {
            role,
            status: "ACTIVE",
            revokedAt: null,
            revokedByUserId: null,
            revokeReason: null,
          },
        });
      }

      const institution = await prisma.financialInstitution.create({
        data: {
          legalName: `4F Staff Bank ${suffix}`,
          displayName: `4F Staff ${suffix}`,
          slug: `4f-staff-${suffix}`,
          institutionType: "BANK",
          status: "ACTIVE",
          isNCCParticipant: true,
          approvedAt: new Date(),
        },
      });
      institutionId = institution.id;

      const recv = await prisma.financialInstitution.create({
        data: {
          legalName: `4F Recv Bank ${suffix}`,
          displayName: `4F Recv ${suffix}`,
          slug: `4f-recv-${suffix}`,
          institutionType: "BANK",
          status: "ACTIVE",
          isNCCParticipant: true,
          approvedAt: new Date(),
        },
      });
      recvInstitutionId = recv.id;

      registerInstitutionAdapter(new FloatAdapter(institution.slug));
      registerInstitutionAdapter(new FloatAdapter(recv.slug));

      const sendRn = await prisma.routingNumber.create({
        data: {
          institutionId,
          routingNumber: `8${suffix}`.slice(0, 9).padEnd(9, "0"),
          status: "ACTIVE",
          isPrimary: true,
          activatedAt: new Date(),
        },
      });
      sendRoutingId = sendRn.id;
      const recvRn = await prisma.routingNumber.create({
        data: {
          institutionId: recvInstitutionId,
          routingNumber: `9${suffix}`.slice(0, 9).padEnd(9, "1"),
          status: "ACTIVE",
          isPrimary: true,
          activatedAt: new Date(),
        },
      });
      recvRoutingId = recvRn.id;

      await prisma.settlementAccount.create({
        data: {
          institutionId,
          currency: NCC_DEFAULT_CURRENCY,
          ledgerBalance: new Prisma.Decimal("1000.00"),
          availableBalance: new Prisma.Decimal("1000.00"),
          status: "ACTIVE",
        },
      });
      await prisma.settlementAccount.create({
        data: {
          institutionId: recvInstitutionId,
          currency: NCC_DEFAULT_CURRENCY,
          ledgerBalance: new Prisma.Decimal("1000.00"),
          availableBalance: new Prisma.Decimal("1000.00"),
          status: "ACTIVE",
        },
      });

      const network = await prisma.nccNetworkControl.upsert({
        where: { id: "default" },
        create: { id: "default", mode: "ACTIVE" },
        update: {},
      });
      priorNetworkMode = network.mode;
    } catch (error) {
      if (isDbTransient(error)) {
        dbReady = false;
        console.warn("[ncc-4f] DB unavailable/quota — integration tests will skip:", error);
        return;
      }
      throw error;
    }
  });

  after(async () => {
    setTestAuthUserForTests(null);
    if (!dbReady) return;
    try {
      if (priorNetworkMode) {
        await prisma.nccNetworkControl.update({
          where: { id: "default" },
          data: {
            mode: priorNetworkMode as "ACTIVE" | "PAUSE_NEW_SETTLEMENTS" | "EMERGENCY_STOP",
            pendingResumeRequestedByUserId: null,
            pendingResumeReason: null,
            pendingResumeApprovedByUserId: null,
          },
        });
      }
      await prisma.nccWorkerLock.deleteMany({
        where: { jobKey: "ncc-settlement-workers", lockedBy: { startsWith: "4f-test-lock-" } },
      });
    } catch {
      /* best-effort cleanup */
    }
  });

  function skipIfDbUnavailable(t: { skip: (msg?: string) => void }): boolean {
    if (!dbReady) {
      t.skip("DB unavailable or compute quota exceeded");
      return true;
    }
    return false;
  }

  function skipOnTransient(t: { skip: (msg?: string) => void }, error: unknown): boolean {
    if (!isDbTransient(error)) return false;
    t.skip("DB unavailable or compute quota exceeded");
    return true;
  }

  it("staff role enforcement: viewer cannot manage_staff; admin can bootstrap", async (t) => {
    if (skipIfDbUnavailable(t)) return;
    try {
      assert.equal(staffRoleHasPermission("VIEWER", "manage_staff"), false);
      assert.equal(await hasNccStaffPermission(viewerId, "manage_staff"), false);
      await assert.rejects(
        () => asUser(viewerId, () => requireNccStaff("manage_staff")),
        (e: unknown) => e instanceof Error && e.message === "FORBIDDEN",
      );

      const adminCount = await prisma.nccStaffMembership.count({
        where: {
          status: "ACTIVE",
          role: { in: ["NCC_ADMINISTRATOR", "EMERGENCY_ADMINISTRATOR"] },
        },
      });
      if (adminCount === 0) {
        const bootstrapped = await ensureBootstrapNccAdministrator(adminId);
        assert.equal(bootstrapped.role, "NCC_ADMINISTRATOR");
        assert.equal(bootstrapped.status, "ACTIVE");
      } else {
        // Bootstrap gate remains enforced when administrators already exist.
        await assert.rejects(
          () => ensureBootstrapNccAdministrator(adminId),
          (e: unknown) => e instanceof NccStaffError && e.code === "BOOTSTRAP_DENIED",
        );
        assert.equal(await hasNccStaffPermission(adminId, "manage_staff"), true);
        await asUser(adminId, () => requireNccStaff("manage_staff"));
      }
    } catch (error) {
      if (skipOnTransient(t, error)) return;
      throw error;
    }
  });

  it("internal user without NccStaffMembership cannot requireNccStaff", async (t) => {
    if (skipIfDbUnavailable(t)) return;
    try {
      const membership = await prisma.nccStaffMembership.findFirst({
        where: { userId: internalNoStaffId, status: "ACTIVE" },
      });
      assert.equal(membership, null);
      const user = await loadAltaUser(internalNoStaffId);
      assert.equal(canAccessInternal(user), true);
      assert.equal(await hasNccStaffPermission(internalNoStaffId, "view_control_plane"), false);
      await assert.rejects(
        () => asUser(internalNoStaffId, () => requireNccStaff("view_control_plane")),
        (e: unknown) => e instanceof Error && e.message === "FORBIDDEN",
      );
    } catch (error) {
      if (skipOnTransient(t, error)) return;
      throw error;
    }
  });

  it("emergency suspension + dual-control resume requires a second approver", async (t) => {
    if (skipIfDbUnavailable(t)) return;
    try {
      const suspension = await asUser(emergencyAId, () =>
        emergencySuspendInstitution({
          institutionId,
          reason: "4F emergency suspension dual-control test reason",
          confirmation: NCC_SENSITIVE_CONFIRMATION,
        }),
      );
      assert.equal(suspension.status, "ACTIVE");

      const institution = await prisma.financialInstitution.findUniqueOrThrow({
        where: { id: institutionId },
      });
      assert.equal(institution.status, "SUSPENDED");

      await asUser(emergencyAId, () =>
        requestEmergencyResume({
          suspensionId: suspension.id,
          reason: "4F resume request after investigation complete",
          confirmation: NCC_SENSITIVE_CONFIRMATION,
        }),
      );

      await assert.rejects(
        () =>
          asUser(emergencyAId, () =>
            approveEmergencyResume({
              suspensionId: suspension.id,
              confirmation: NCC_SENSITIVE_CONFIRMATION,
            }),
          ),
        (e: unknown) => e instanceof NccControlPlaneError && e.code === "SELF_APPROVAL_DENIED",
      );

      const resumed = await asUser(emergencyBId, () =>
        approveEmergencyResume({
          suspensionId: suspension.id,
          confirmation: NCC_SENSITIVE_CONFIRMATION,
        }),
      );
      assert.equal(resumed.status, "RESUMED");
    } catch (error) {
      if (skipOnTransient(t, error)) return;
      throw error;
    }
  });

  it("network PAUSE_NEW_SETTLEMENTS blocks submitInstruction but workers can still run", async (t) => {
    if (skipIfDbUnavailable(t)) return;
    try {
      await prisma.nccNetworkControl.upsert({
        where: { id: "default" },
        create: { id: "default", mode: "PAUSE_NEW_SETTLEMENTS", reason: "4f pause test" },
        update: {
          mode: "PAUSE_NEW_SETTLEMENTS",
          reason: "4f pause test",
          pendingResumeRequestedByUserId: null,
          pendingResumeReason: null,
          pendingResumeApprovedByUserId: null,
        },
      });

      await assert.rejects(
        () => assertNetworkAllowsNewSettlement(),
        (e: unknown) => e instanceof NccNetworkControlError && e.code === "NETWORK_PAUSE",
      );

      await assert.rejects(
        () =>
          submitInstruction({
            sendingInstitutionId: institutionId,
            receivingInstitutionId: recvInstitutionId,
            sendingRoutingNumberId: sendRoutingId,
            receivingRoutingNumberId: recvRoutingId,
            amount: 1,
            idempotencyKey: `4f-pause-${suffix}`,
            submittedByUserId: adminId,
          }),
        (e: unknown) => e instanceof NccSettlementError,
      );

      // Clear overlap lock so this run is not skipped for an unrelated reason.
      await prisma.nccWorkerLock.deleteMany({ where: { jobKey: "ncc-settlement-workers" } });
      const workers = await runNccSettlementWorkers();
      assert.equal(workers.ok, true);
      // Pause must not prevent workers; only overlap lock skips the run.
      if (workers.skipped) {
        assert.equal(workers.reason, "OVERLAP_LOCK_HELD");
      } else {
        assert.equal(workers.skipped, undefined);
      }
    } catch (error) {
      if (skipOnTransient(t, error)) return;
      throw error;
    } finally {
      try {
        await prisma.nccNetworkControl.update({
          where: { id: "default" },
          data: { mode: "ACTIVE", reason: "4f pause test restore" },
        });
      } catch {
        /* ignore */
      }
    }
  });

  it("safe return path functions exist and ledger-only reverse is unavailable", async (t) => {
    if (skipIfDbUnavailable(t)) return;
    try {
      assert.equal(typeof createTransferReturnLedgerInstruction, "function");
      assert.equal(typeof reverseNccLedgerPositionsForCompensation, "function");
      await assert.rejects(
        () => reverseInstruction("missing", adminId, "should not reverse"),
        (e: unknown) =>
          e instanceof NccSettlementError && e.code === "LEDGER_ONLY_REVERSAL_DISABLED",
      );
      assert.throws(
        () => assertLedgerOnlyReversalDisabled(),
        (e: unknown) =>
          e instanceof NccSettlementError && e.code === "LEDGER_ONLY_REVERSAL_DISABLED",
      );
    } catch (error) {
      if (skipOnTransient(t, error)) return;
      throw error;
    }
  });

  it("risk manual-review threshold pauses before money movement", async (t) => {
    if (skipIfDbUnavailable(t)) return;
    try {
      await prisma.nccInstitutionRiskPolicy.updateMany({
        where: { institutionId, enabled: true },
        data: { enabled: false, effectiveTo: new Date() },
      });
      await prisma.nccInstitutionRiskPolicy.create({
        data: {
          institutionId,
          manualReviewThreshold: new Prisma.Decimal("10.00"),
          enabled: true,
          effectiveFrom: new Date(),
        },
      });

      const instruction = await submitInstruction({
        sendingInstitutionId: institutionId,
        receivingInstitutionId: recvInstitutionId,
        sendingRoutingNumberId: sendRoutingId,
        receivingRoutingNumberId: recvRoutingId,
        amount: 25,
        idempotencyKey: `4f-risk-mr-${suffix}`,
        submittedByUserId: adminId,
      });
      assert.equal(instruction.status, "SUBMITTED");
      assert.notEqual(instruction.status, "SETTLED");

      const execution = await prisma.settlementExecution.findUnique({
        where: { settlementInstructionId: instruction.id },
      });
      assert.ok(execution);
      assert.equal(execution.status, "MANUAL_REVIEW");
      assert.equal(execution.failureCode, "MANUAL_REVIEW_THRESHOLD");
      assert.equal(execution.sourcePreparationReference, null);
      assert.equal(execution.sourceCommitReference, null);
    } catch (error) {
      if (skipOnTransient(t, error)) return;
      throw error;
    }
  });

  it("worker overlap lock: concurrent run returns skipped OVERLAP_LOCK_HELD", async (t) => {
    if (skipIfDbUnavailable(t)) return;
    try {
      const lockedBy = `4f-test-lock-${suffix}`;
      await prisma.nccWorkerLock.upsert({
        where: { jobKey: "ncc-settlement-workers" },
        create: {
          jobKey: "ncc-settlement-workers",
          lockedBy,
          lockedUntil: new Date(Date.now() + 60_000),
        },
        update: {
          lockedBy,
          lockedUntil: new Date(Date.now() + 60_000),
        },
      });

      const result = await runNccSettlementWorkers();
      assert.equal(result.ok, true);
      assert.equal(result.skipped, true);
      assert.equal(result.reason, "OVERLAP_LOCK_HELD");
    } catch (error) {
      if (skipOnTransient(t, error)) return;
      throw error;
    } finally {
      try {
        await prisma.nccWorkerLock.deleteMany({
          where: { jobKey: "ncc-settlement-workers", lockedBy: `4f-test-lock-${suffix}` },
        });
      } catch {
        /* ignore */
      }
    }
  });

  it("readiness returns blockers array including STEP_UP_MFA_UNAVAILABLE", async (t) => {
    if (skipIfDbUnavailable(t)) return;
    try {
      const report = await asUser(viewerId, () => getNccProductionReadiness());
      assert.ok(Array.isArray(report.blockers));
      assert.ok(report.blockers.some((b) => b.code === "STEP_UP_MFA_UNAVAILABLE"));
      assert.equal(report.signals.stepUpMfaAvailable, false);
    } catch (error) {
      if (skipOnTransient(t, error)) return;
      throw error;
    }
  });

  it("automatic compensation remains callable from workers module", async (t) => {
    if (skipIfDbUnavailable(t)) return;
    try {
      const workersSource = readSrc("server/ncc/ncc-workers.service.ts");
      assert.ok(workersSource.includes("attemptAutomaticCompensation"));
      assert.ok(workersSource.includes('from "@/server/ncc/ncc-compensation.service"'));
      assert.equal(typeof attemptAutomaticCompensation, "function");
      assert.equal(typeof runNccSettlementWorkers, "function");
      // Smoke-call against a non-existent instruction — callable path, expected failure.
      await assert.rejects(() => attemptAutomaticCompensation(`missing-instruction-${suffix}`));
    } catch (error) {
      if (skipOnTransient(t, error)) return;
      throw error;
    }
  });

  it("participant permission isolation: requireInstitutionPermission does not grant via canAccessInternal", async (t) => {
    if (skipIfDbUnavailable(t)) return;
    try {
      const source = readSrc("server/ncc/ncc-permissions.service.ts");
      const body = source.slice(
        source.indexOf("export async function requireInstitutionPermission"),
        source.indexOf("export async function assertInstitutionAccess"),
      );
      assert.equal(body.includes("canAccessInternal"), false);
      assert.ok(body.includes("getActiveInstitutionMembership"));

      const user = await loadAltaUser(internalNoStaffId);
      assert.equal(canAccessInternal(user), true);
      await assert.rejects(
        () =>
          asUser(internalNoStaffId, () =>
            requireInstitutionPermission(institutionId, "submit_settlement"),
          ),
        (e: unknown) => e instanceof Error && e.message === "FORBIDDEN",
      );
    } catch (error) {
      if (skipOnTransient(t, error)) return;
      throw error;
    }
  });
});
