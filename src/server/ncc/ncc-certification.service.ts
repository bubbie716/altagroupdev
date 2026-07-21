import { prisma } from "@/server/db";
import { requireNccStaff } from "@/server/ncc/ncc-permissions.service";
import { callExternalConnector } from "@/server/ncc/ncc-external-connector-client";
import { resolveFromActiveDirectory } from "@/server/ncc/ncc-directory.service";
import { ExternalParticipantAdapter } from "@/server/ncc/adapters/external-participant.adapter";

export class NccCertificationError extends Error {
  constructor(
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "NccCertificationError";
  }
}

/** Required certification checks for LIVE eligibility. */
export const CERTIFICATION_CHECK_KEYS = [
  "connector_authentication",
  "account_resolution",
  "unsupported_identifier",
  "closed_frozen_account",
  "currency_mismatch",
  "prepare_debit",
  "duplicate_prepare",
  "commit_debit",
  "duplicate_commit",
  "release",
  "credit",
  "duplicate_credit",
  "compensation",
  "operation_status_recovery",
  "timeout_behavior",
  "invalid_signature",
  "webhook_signature_verification",
  "webhook_retry_handling",
  "reconciliation_response",
  "money_movement_requires_api",
] as const;

export type CertificationCheckKey = (typeof CERTIFICATION_CHECK_KEYS)[number];

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function startCertificationRunAsStaff(institutionId: string, staffUserId: string) {
  const connector = await prisma.nccParticipantConnector.findUnique({
    where: { institutionId },
  });
  if (!connector || connector.status === "DRAFT") {
    throw new NccCertificationError("CONNECTOR_REQUIRED", "Configure a connector before certification.");
  }

  const run = await prisma.nccCertificationRun.create({
    data: {
      institutionId,
      status: "IN_PROGRESS",
      startedByUserId: staffUserId,
      checks: {
        create: CERTIFICATION_CHECK_KEYS.map((checkKey) => ({ checkKey, status: "PENDING" })),
      },
    },
    include: { checks: true },
  });

  await prisma.nccParticipantConnector.update({
    where: { id: connector.id },
    data: { certificationStatus: "IN_PROGRESS" },
  });

  return run;
}

export async function startCertificationRun(institutionId: string) {
  const staff = await requireNccStaff();
  return startCertificationRunAsStaff(institutionId, staff.id);
}

async function setCheck(
  runId: string,
  checkKey: string,
  status: "PASS" | "FAIL" | "SKIP" | "PENDING",
  detail?: string,
) {
  await prisma.nccCertificationCheck.update({
    where: { runId_checkKey: { runId, checkKey } },
    data: {
      status: status === "PENDING" ? "PENDING" : status,
      detail: detail ?? null,
      checkedAt: status === "PENDING" ? null : new Date(),
    },
  });
}

/**
 * Execute certification against TEST connector / directory.
 * PASS only when the participant connector demonstrated the behavior.
 * Checks that cannot be auto-verified remain FAIL pending staff evidence.
 */
export async function executeCertificationRunAsStaff(runId: string, staffUserId: string) {
  const run = await prisma.nccCertificationRun.findUniqueOrThrow({
    where: { id: runId },
    include: { checks: true },
  });
  if (run.status !== "IN_PROGRESS") {
    throw new NccCertificationError("RUN_NOT_ACTIVE", "Certification run is not in progress.");
  }

  const connector = await prisma.nccParticipantConnector.findUnique({
    where: { institutionId: run.institutionId },
  });
  if (!connector) throw new NccCertificationError("CONNECTOR_REQUIRED");

  const isApi = connector.mode === "API" && !!connector.baseUrl;
  const isDirectory = connector.mode === "DIRECTORY";
  const adapter = new ExternalParticipantAdapter(run.institutionId);

  if (isApi) {
    const auth = await callExternalConnector({
      baseUrl: connector.baseUrl!,
      authSecretEncrypted: connector.authSecretEncrypted,
      timeoutMs: connector.timeoutMs,
      op: "queryStatus",
      body: { requestId: `cert_auth_${runId}`, idempotencyKey: `cert-auth:${runId}` },
      requireHttps: true,
    });
    await setCheck(
      runId,
      "connector_authentication",
      auth.ok ? "PASS" : "FAIL",
      auth.ok ? "Authenticated status query succeeded" : auth.reason,
    );
  } else {
    await setCheck(runId, "connector_authentication", "SKIP", "Directory mode — no live auth probe");
  }

  let sourceRef: string | null = null;
  let destRef: string | null = null;

  if (isDirectory) {
    const probe = await resolveFromActiveDirectory({
      institutionId: run.institutionId,
      accountIdentifier: "__cert_probe_missing__",
      currency: "FLR",
      direction: "credit",
    });
    // PASS only when an active directory exists (probe of missing id → ACCOUNT_UNAVAILABLE).
    const directoryReady = probe.ok === false && probe.code !== "DIRECTORY_NOT_ACTIVE";
    await setCheck(
      runId,
      "account_resolution",
      directoryReady ? "PASS" : "FAIL",
      directoryReady ? `Directory active (${probe.ok ? "resolved" : probe.code})` : "No active directory",
    );
  } else if (isApi) {
    const sourceId = connector.certSourceAccountIdentifier?.trim();
    const destId = connector.certDestinationAccountIdentifier?.trim();
    if (!sourceId || !destId) {
      await setCheck(
        runId,
        "account_resolution",
        "FAIL",
        "Configure certSourceAccountIdentifier and certDestinationAccountIdentifier before certification",
      );
    } else {
      const sourceResolved = await adapter.resolveAccount({
        accountNumber: sourceId,
        currency: "FLR",
        direction: "debit",
      });
      const destResolved = await adapter.resolveAccount({
        accountNumber: destId,
        currency: "FLR",
        direction: "credit",
      });
      const ok = sourceResolved.ok && destResolved.ok;
      if (sourceResolved.ok) sourceRef = sourceResolved.account.internalAccountReference;
      if (destResolved.ok) destRef = destResolved.account.internalAccountReference;
      await setCheck(
        runId,
        "account_resolution",
        ok ? "PASS" : "FAIL",
        ok
          ? "Resolved configured TEST source and destination accounts"
          : `Resolve failed: ${
              !sourceResolved.ok
                ? sourceResolved.reason
                : !destResolved.ok
                  ? destResolved.reason
                  : "unknown"
            }`,
      );
    }
  } else {
    await setCheck(runId, "account_resolution", "FAIL", "No resolution mode configured");
  }

  // These require connector-demonstrated negative cases — leave failed for staff evidence unless proven.
  await setCheck(
    runId,
    "unsupported_identifier",
    "FAIL",
    "Requires participant to reject an unsupported identifier; awaiting automatic or staff evidence",
  );
  await setCheck(
    runId,
    "closed_frozen_account",
    "FAIL",
    "Requires participant to reject a closed/frozen account; awaiting automatic or staff evidence",
  );
  await setCheck(
    runId,
    "currency_mismatch",
    "FAIL",
    "Requires participant to reject unsupported currency; awaiting automatic or staff evidence",
  );

  if (!isApi) {
    for (const key of [
      "prepare_debit",
      "duplicate_prepare",
      "commit_debit",
      "duplicate_commit",
      "release",
      "credit",
      "duplicate_credit",
      "compensation",
      "operation_status_recovery",
      "timeout_behavior",
      "invalid_signature",
    ] as const) {
      await setCheck(runId, key, "FAIL", "Directory-only cannot move money");
    }
    await setCheck(
      runId,
      "money_movement_requires_api",
      "FAIL",
      "Spreadsheet directory alone cannot certify for instant settlement",
    );
  } else if (!sourceRef || !destRef) {
    for (const key of [
      "prepare_debit",
      "duplicate_prepare",
      "commit_debit",
      "duplicate_commit",
      "release",
      "credit",
      "duplicate_credit",
      "compensation",
      "operation_status_recovery",
      "timeout_behavior",
      "invalid_signature",
      "money_movement_requires_api",
    ] as const) {
      await setCheck(runId, key, "FAIL", "Money-movement checks require resolved TEST accounts");
    }
  } else {
    const prepInput = {
      settlementInstructionId: `cert-prep-${runId}`,
      publicReference: `NCC-CERT-${runId.slice(0, 8)}`,
      amount: "1.00",
      currency: "FLR",
      accountReference: sourceRef,
    };
    const prep = await adapter.prepareDebitForCertification(prepInput);
    const prep2 = await adapter.prepareDebitForCertification(prepInput);
    await setCheck(
      runId,
      "prepare_debit",
      prep.ok ? "PASS" : "FAIL",
      prep.ok ? `holdReference=${prep.holdReference}` : prep.reason,
    );
    await setCheck(
      runId,
      "duplicate_prepare",
      prep.ok && prep2.ok && prep.holdReference === prep2.holdReference ? "PASS" : "FAIL",
      prep.ok && prep2.ok
        ? prep.holdReference === prep2.holdReference
          ? "Stable holdReference on duplicate prepare"
          : "Duplicate prepare returned different holdReference"
        : "Duplicate prepare did not both succeed",
    );

    if (prep.ok) {
      const prepForCommit = await adapter.prepareDebitForCertification({
        ...prepInput,
        settlementInstructionId: `cert-commit-${runId}`,
      });
      if (!prepForCommit.ok) {
        await setCheck(runId, "commit_debit", "FAIL", prepForCommit.reason);
        await setCheck(runId, "duplicate_commit", "FAIL", "Skipped — prepare for commit failed");
        await setCheck(runId, "release", "FAIL", "Skipped");
      } else {
        const commitBody = {
          ...prepInput,
          settlementInstructionId: `cert-commit-${runId}`,
          holdReference: prepForCommit.holdReference,
        };
        const commit = await adapter.commitDebitForCertification(commitBody);
        const commit2 = await adapter.commitDebitForCertification(commitBody);
        await setCheck(
          runId,
          "commit_debit",
          commit.ok ? "PASS" : "FAIL",
          commit.ok ? `externalReference=${commit.externalReference}` : commit.reason,
        );
        await setCheck(
          runId,
          "duplicate_commit",
          commit.ok && commit2.ok && commit.externalReference === commit2.externalReference
            ? "PASS"
            : "FAIL",
          commit.ok && commit2.ok
            ? commit.externalReference === commit2.externalReference
              ? "Stable externalReference on duplicate commit"
              : "Duplicate commit returned different externalReference"
            : "Duplicate commit did not both succeed",
        );

        const prepRelease = await adapter.prepareDebitForCertification({
          ...prepInput,
          settlementInstructionId: `cert-release-${runId}`,
        });
        if (!prepRelease.ok) {
          await setCheck(runId, "release", "FAIL", prepRelease.reason);
        } else {
          try {
            await adapter.releaseDebitForCertification({
              holdReference: prepRelease.holdReference,
              settlementInstructionId: `cert-release-${runId}`,
            });
            await setCheck(runId, "release", "PASS", "Release confirmed by connector");
          } catch (e) {
            await setCheck(
              runId,
              "release",
              "FAIL",
              e instanceof Error ? e.message : "Release failed",
            );
          }
        }
      }
    } else {
      await setCheck(runId, "commit_debit", "FAIL", "Skipped — prepare failed");
      await setCheck(runId, "duplicate_commit", "FAIL", "Skipped");
      await setCheck(runId, "release", "FAIL", "Skipped");
    }

    const creditInput = {
      settlementInstructionId: `cert-credit-${runId}`,
      publicReference: `NCC-CERT-C-${runId.slice(0, 8)}`,
      amount: "1.00",
      currency: "FLR",
      accountReference: destRef,
    };
    const credit = await adapter.notifyCreditForCertification(creditInput);
    const credit2 = await adapter.notifyCreditForCertification(creditInput);
    await setCheck(
      runId,
      "credit",
      credit.ok && credit.credited ? "PASS" : "FAIL",
      credit.ok ? `externalReference=${credit.externalReference}` : credit.reason,
    );
    await setCheck(
      runId,
      "duplicate_credit",
      credit.ok &&
        credit2.ok &&
        credit.externalReference &&
        credit.externalReference === credit2.externalReference
        ? "PASS"
        : "FAIL",
      credit.ok && credit2.ok
        ? credit.externalReference === credit2.externalReference
          ? "Stable externalReference on duplicate credit"
          : "Duplicate credit returned different externalReference"
        : "Duplicate credit did not both succeed",
    );

    const comp = await adapter.compensateDebitForCertification({
      settlementInstructionId: `cert-comp-${runId}`,
      publicReference: `NCC-CERT-X-${runId.slice(0, 8)}`,
      amount: "1.00",
      currency: "FLR",
      accountReference: sourceRef,
    });
    await setCheck(
      runId,
      "compensation",
      comp.ok ? "PASS" : "FAIL",
      comp.ok ? `externalReference=${comp.externalReference}` : comp.reason,
    );

    const statusProbe = await callExternalConnector({
      baseUrl: connector.baseUrl!,
      authSecretEncrypted: connector.authSecretEncrypted,
      timeoutMs: connector.timeoutMs,
      op: "queryStatus",
      body: {
        requestId: `cert_status_${runId}`,
        idempotencyKey: `commit:cert-commit-${runId}`,
      },
    });
    const statusOk =
      statusProbe.ok &&
      typeof statusProbe.body.status === "string" &&
      !!nonEmptyString(statusProbe.body.externalReference);
    await setCheck(
      runId,
      "operation_status_recovery",
      statusOk ? "PASS" : "FAIL",
      statusOk
        ? "Status lookup returned confirmed operation reference"
        : "Status lookup did not confirm a prior operation",
    );
    await setCheck(
      runId,
      "timeout_behavior",
      "FAIL",
      "Requires observed ambiguous timeout + status recovery; awaiting staff evidence",
    );

    const badSig = await callExternalConnector({
      baseUrl: connector.baseUrl!,
      authSecretEncrypted: null,
      timeoutMs: connector.timeoutMs,
      op: "queryStatus",
      body: { requestId: `cert_badsig_${runId}`, idempotencyKey: `cert-badsig:${runId}` },
    });
    await setCheck(
      runId,
      "invalid_signature",
      !badSig.ok && badSig.code === "CONNECTOR_AUTH_MISSING" ? "PASS" : "FAIL",
      !badSig.ok ? badSig.reason : "Missing secret unexpectedly succeeded",
    );

    await setCheck(runId, "money_movement_requires_api", "PASS", "API connector money path exercised");
  }

  // Webhook/reconciliation: do not auto-pass merely because NCC supports the feature.
  await setCheck(
    runId,
    "webhook_signature_verification",
    "FAIL",
    "Requires participant webhook signature evidence; awaiting staff evidence",
  );
  await setCheck(
    runId,
    "webhook_retry_handling",
    "FAIL",
    "Requires participant webhook retry evidence; awaiting staff evidence",
  );
  await setCheck(
    runId,
    "reconciliation_response",
    "FAIL",
    "Requires participant reconciliation evidence; awaiting staff evidence",
  );

  const checks = await prisma.nccCertificationCheck.findMany({ where: { runId } });
  const failed = checks.filter((c) => c.status === "FAIL" || c.status === "PENDING");
  const passed = failed.length === 0;
  const updated = await prisma.nccCertificationRun.update({
    where: { id: runId },
    data: {
      status: passed ? "PASSED" : "FAILED",
      completedAt: new Date(),
      reviewedByUserId: staffUserId,
      approvedAt: passed ? new Date() : null,
    },
    include: { checks: true },
  });

  await prisma.nccParticipantConnector.update({
    where: { institutionId: run.institutionId },
    data: {
      certificationStatus: passed ? "PASSED" : "FAILED",
      lastSuccessfulCheckAt: passed ? new Date() : undefined,
      lastErrorCode: passed ? null : failed[0]?.checkKey ?? "CERTIFICATION_FAILED",
      status: passed ? "ACTIVE" : connector.status,
    },
  });

  return updated;
}

export async function executeCertificationRun(runId: string) {
  const staff = await requireNccStaff();
  return executeCertificationRunAsStaff(runId, staff.id);
}

export async function getLatestCertificationRun(institutionId: string) {
  await requireNccStaff();
  return prisma.nccCertificationRun.findFirst({
    where: { institutionId },
    orderBy: { createdAt: "desc" },
    include: { checks: { orderBy: { checkKey: "asc" } } },
  });
}

export async function institutionCertificationPassed(institutionId: string): Promise<boolean> {
  const connector = await prisma.nccParticipantConnector.findUnique({
    where: { institutionId },
  });
  if (!connector || connector.certificationStatus !== "PASSED") return false;
  const run = await prisma.nccCertificationRun.findFirst({
    where: { institutionId, status: "PASSED" },
    orderBy: { completedAt: "desc" },
  });
  return !!run;
}

/** Test-only: mark connector certified without claiming honest checklist evidence. */
export async function markCertificationPassedForTests(institutionId: string, staffUserId: string) {
  const run = await startCertificationRunAsStaff(institutionId, staffUserId);
  for (const key of CERTIFICATION_CHECK_KEYS) {
    await setCheck(run.id, key, "PASS", "test fixture");
  }
  await prisma.nccCertificationRun.update({
    where: { id: run.id },
    data: {
      status: "PASSED",
      completedAt: new Date(),
      reviewedByUserId: staffUserId,
      approvedAt: new Date(),
    },
  });
  await prisma.nccParticipantConnector.update({
    where: { institutionId },
    data: { certificationStatus: "PASSED", status: "ACTIVE", lastSuccessfulCheckAt: new Date() },
  });
  return run.id;
}

/** Staff may record evidence for checks that cannot be auto-verified. */
export async function staffRecordCertificationEvidence(input: {
  runId: string;
  checkKey: CertificationCheckKey;
  status: "PASS" | "FAIL";
  detail: string;
}) {
  const staff = await requireNccStaff();
  const run = await prisma.nccCertificationRun.findUniqueOrThrow({ where: { id: input.runId } });
  if (run.status !== "IN_PROGRESS" && run.status !== "FAILED") {
    throw new NccCertificationError("RUN_NOT_EDITABLE", "Certification run cannot accept evidence.");
  }
  await setCheck(input.runId, input.checkKey, input.status, `${input.detail} (staff:${staff.id})`);
  const checks = await prisma.nccCertificationCheck.findMany({ where: { runId: input.runId } });
  const failed = checks.filter((c) => c.status === "FAIL" || c.status === "PENDING");
  const passed = failed.length === 0;
  return prisma.nccCertificationRun.update({
    where: { id: input.runId },
    data: {
      status: passed ? "PASSED" : "FAILED",
      completedAt: new Date(),
      reviewedByUserId: staff.id,
      approvedAt: passed ? new Date() : null,
    },
    include: { checks: true },
  });
}
