import type { PayrollRun } from "@prisma/client";
import { Prisma } from "@prisma/client";
import type { PayDayCode } from "@/lib/bank/payroll-pay-day";
import { computeNextPayDate } from "@/lib/bank/payroll-pay-day";
import { prisma } from "@/server/db";
import { parsePayrollLineItems, paymentFrequencyFromDb } from "@/server/business-banking-mapper";
import { isAccountAccessibleByUser, normalizeAccountNumber, submitInternalTransfer } from "@/server/bank.service";
import { toFriendlyFailureReason } from "@/server/scheduled-transfer-executor.service";

const FAILURE_THRESHOLD = 3;

export interface ExecuteDuePayrollRunsOptions {
  now?: Date;
  runIds?: string[];
}

export interface ExecuteDuePayrollRunsResult {
  dueCount: number;
  executedCount: number;
  failedCount: number;
  skippedCount: number;
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function findOutTransactionId(referenceCode: string): Promise<string | null> {
  const tx = await prisma.bankTransaction.findUnique({
    where: { referenceCode: `${referenceCode}-OUT` },
    select: { id: true },
  });
  return tx?.id ?? null;
}

async function acquirePayrollRunExecution(
  payrollRunId: string,
  scheduledRunAt: Date,
  now: Date,
): Promise<{ id: string } | "skipped"> {
  try {
    const execution = await prisma.payrollRunExecution.create({
      data: {
        payrollRunId,
        scheduledRunAt,
        status: "PENDING",
      },
    });
    return { id: execution.id };
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const existing = await prisma.payrollRunExecution.findUnique({
      where: {
        payrollRunId_scheduledRunAt: {
          payrollRunId,
          scheduledRunAt,
        },
      },
    });
    if (!existing) {
      throw error;
    }

    if (existing.status === "EXECUTED") {
      return "skipped";
    }

    if (existing.status === "PENDING") {
      const ageMs = now.getTime() - existing.createdAt.getTime();
      if (ageMs < 120_000) {
        return "skipped";
      }
      return { id: existing.id };
    }

    if (existing.status === "FAILED") {
      await prisma.payrollRunExecution.update({
        where: { id: existing.id },
        data: { status: "PENDING", failureReason: null, executedAt: null },
      });
      return { id: existing.id };
    }

    return "skipped";
  }
}

async function recordPayrollFailure(
  run: PayrollRun,
  executionId: string,
  now: Date,
  reason: string,
): Promise<void> {
  const consecutiveFailures = run.consecutiveFailures + 1;
  const shouldFail = consecutiveFailures >= FAILURE_THRESHOLD;

  await prisma.$transaction(async (tx) => {
    await tx.payrollRunExecution.update({
      where: { id: executionId },
      data: {
        status: "FAILED",
        failureReason: reason,
        executedAt: now,
      },
    });

    await tx.payrollRun.update({
      where: { id: run.id },
      data: {
        lastRunAt: now,
        consecutiveFailures,
        lastFailureReason: shouldFail ? "Paused after repeated failures." : reason,
        status: shouldFail ? "FAILED" : "APPROVED",
      },
    });
  });

  const { writeAuditLog } = await import("@/server/audit.service");
  const { auditSourceMetadata } = await import("@/lib/internal/audit-metadata");
  await writeAuditLog({
    actorUserId: run.createdByUserId,
    action: "BANK_PAYROLL_RUN_FAILED",
    entityType: "PAYROLL_RUN",
    entityId: run.id,
    targetAccountId: run.bankAccountId,
    targetCompanyId: run.companyId,
    description: `Payroll batch "${run.label}" failed`,
    metadata: auditSourceMetadata("cron", {
      amount: Number(run.totalAmount.toString()),
      reason,
      consecutiveFailures,
      severity: "warning",
      requiresAction: shouldFail,
    }),
  });

  try {
    const { notifyPayrollRunFailed } = await import("@/server/banking-notification.service");
    await notifyPayrollRunFailed(run.createdByUserId, {
      label: run.label,
      totalAmount: Number(run.totalAmount.toString()),
      reason,
      bankAccountId: run.bankAccountId,
      companyId: run.companyId,
      payrollRunId: run.id,
      failedPermanently: shouldFail,
    });
  } catch (error) {
    console.error("[payroll] failed notification error", error);
  }
}

async function executeSinglePayrollRun(
  run: PayrollRun,
  scheduledRunAt: Date,
  now: Date,
): Promise<"executed" | "failed" | "skipped"> {
  const lineItems = parsePayrollLineItems(run.lineItems);
  if (lineItems.length === 0) {
    return "skipped";
  }

  const acquired = await acquirePayrollRunExecution(run.id, scheduledRunAt, now);
  if (acquired === "skipped") {
    return "skipped";
  }
  const executionId = acquired.id;

  const sourceAccount = await prisma.bankAccount.findUnique({
    where: { id: run.bankAccountId },
  });
  if (!sourceAccount || sourceAccount.status !== "ACTIVE") {
    await recordPayrollFailure(run, executionId, now, "Source account unavailable.");
    return "failed";
  }

  for (const line of lineItems) {
    if (!line.accountNumber?.trim()) {
      await recordPayrollFailure(run, executionId, now, "Employee payout account unavailable.");
      return "failed";
    }

    await prisma.payrollRunLineExecution.upsert({
      where: {
        payrollRunExecutionId_employeeId: {
          payrollRunExecutionId: executionId,
          employeeId: line.employeeId,
        },
      },
      create: {
        payrollRunExecutionId: executionId,
        employeeId: line.employeeId,
        displayName: line.displayName,
        accountNumber: line.accountNumber,
        amount: line.amount,
        status: "PENDING",
      },
      update: {},
    });
  }

  const lineExecutions = await prisma.payrollRunLineExecution.findMany({
    where: { payrollRunExecutionId: executionId },
    orderBy: { createdAt: "asc" },
  });

  for (const lineExecution of lineExecutions) {
    if (lineExecution.status === "EXECUTED") {
      continue;
    }

    const destinationNumber = normalizeAccountNumber(lineExecution.accountNumber);
    const destinationAccount = await prisma.bankAccount.findUnique({
      where: { accountNumber: destinationNumber },
    });
    if (!destinationAccount || destinationAccount.status !== "ACTIVE") {
      await prisma.payrollRunLineExecution.update({
        where: { id: lineExecution.id },
        data: {
          status: "FAILED",
          failureReason: "Employee payout account unavailable.",
          executedAt: now,
        },
      });
      await recordPayrollFailure(run, executionId, now, "Employee payout account unavailable.");
      return "failed";
    }

    const amount = Number(lineExecution.amount.toString());
    const creatorHasDestination = await isAccountAccessibleByUser(
      destinationAccount.id,
      run.createdByUserId,
    );
    const memoParts = [run.memo?.trim(), `Payroll · ${lineExecution.displayName}`].filter(Boolean);

    try {
      const { referenceCode } = await submitInternalTransfer(run.createdByUserId, {
        fromAccountId: run.bankAccountId,
        toAccountId: creatorHasDestination ? destinationAccount.id : undefined,
        toAccountNumber: creatorHasDestination ? undefined : destinationNumber,
        amount,
        memo: memoParts.join(" · ") || undefined,
      });

      const bankTransactionId = await findOutTransactionId(referenceCode);
      await prisma.payrollRunLineExecution.update({
        where: { id: lineExecution.id },
        data: {
          status: "EXECUTED",
          bankTransactionId,
          failureReason: null,
          executedAt: now,
        },
      });
      await advanceEmployeePaySchedule(lineExecution.employeeId, now);
    } catch (error) {
      const reason = toFriendlyFailureReason(error);
      await prisma.payrollRunLineExecution.update({
        where: { id: lineExecution.id },
        data: {
          status: "FAILED",
          failureReason: reason,
          executedAt: now,
        },
      });
      await recordPayrollFailure(run, executionId, now, reason);
      return "failed";
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.payrollRunExecution.update({
      where: { id: executionId },
      data: {
        status: "EXECUTED",
        failureReason: null,
        executedAt: now,
      },
    });

    await tx.payrollRun.update({
      where: { id: run.id },
      data: {
        status: "EXECUTED",
        lastRunAt: now,
        consecutiveFailures: 0,
        lastFailureReason: null,
      },
    });
  });

  const totalAmount = Number(run.totalAmount.toString());
  const { writeAuditLog } = await import("@/server/audit.service");
  const { auditSourceMetadata } = await import("@/lib/internal/audit-metadata");
  await writeAuditLog({
    actorUserId: run.createdByUserId,
    action: "BANK_PAYROLL_RUN_EXECUTED",
    entityType: "PAYROLL_RUN",
    entityId: run.id,
    targetAccountId: run.bankAccountId,
    targetCompanyId: run.companyId,
    description: `Executed payroll batch "${run.label}"`,
    metadata: auditSourceMetadata("cron", {
      amount: totalAmount,
      employeeCount: lineItems.length,
      scheduledRunAt: scheduledRunAt.toISOString(),
    }),
  });

  try {
    const { notifyPayrollRunExecuted } = await import("@/server/banking-notification.service");
    await notifyPayrollRunExecuted(run.createdByUserId, {
      label: run.label,
      totalAmount,
      employeeCount: lineItems.length,
      bankAccountId: run.bankAccountId,
      companyId: run.companyId,
      payrollRunId: run.id,
    });
  } catch (error) {
    console.error("[payroll] executed notification failed", error);
  }

  return "executed";
}

async function advanceEmployeePaySchedule(employeeId: string, paidAt: Date): Promise<void> {
  const employee = await prisma.payrollEmployee.findUnique({ where: { id: employeeId } });
  if (!employee) return;

  const frequency = paymentFrequencyFromDb(employee.payFrequency);
  const nextPayDate = computeNextPayDate(
    frequency,
    employee.payDay as PayDayCode,
    paidAt,
    true,
    employee.createdAt,
  );

  await prisma.payrollEmployee.update({
    where: { id: employeeId },
    data: {
      lastPaidAt: paidAt,
      nextPayDate,
    },
  });
}

async function findPayrollActorForCompany(companyId: string): Promise<string | null> {
  const membership = await prisma.companyMembership.findFirst({
    where: {
      companyId,
      role: { in: ["OWNER", "EXECUTIVE", "FINANCE_MANAGER"] },
    },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  return membership?.userId ?? null;
}

async function ensureEmployeeNextPayDates(): Promise<void> {
  const missing = await prisma.payrollEmployee.findMany({
    where: { status: "ACTIVE", nextPayDate: null },
  });

  for (const employee of missing) {
    const frequency = paymentFrequencyFromDb(employee.payFrequency);
    const nextPayDate = computeNextPayDate(
      frequency,
      employee.payDay as PayDayCode,
      new Date(),
      false,
      employee.createdAt,
    );
    await prisma.payrollEmployee.update({
      where: { id: employee.id },
      data: { nextPayDate },
    });
  }
}

async function createAutoPayrollRunsForDueEmployees(now: Date): Promise<void> {
  await ensureEmployeeNextPayDates();
  const dueEmployees = await prisma.payrollEmployee.findMany({
    where: {
      status: "ACTIVE",
      nextPayDate: { lte: now },
    },
  });

  for (const employee of dueEmployees) {
    if (!employee.accountNumber || employee.accountNumber === "AB-0000-000000") {
      continue;
    }
    if (!employee.nextPayDate) continue;

    const existing = await prisma.payrollRun.findFirst({
      where: {
        autoEmployeeId: employee.id,
        payDate: employee.nextPayDate,
        status: { notIn: ["CANCELLED", "REJECTED"] },
      },
    });
    if (existing) {
      if (existing.status === "FAILED") {
        await prisma.payrollRun.update({
          where: { id: existing.id },
          data: {
            status: "APPROVED",
            consecutiveFailures: 0,
            lastFailureReason: null,
          },
        });
      }
      continue;
    }

    const operatingAccount = await prisma.bankAccount.findFirst({
      where: {
        companyId: employee.companyId,
        accountType: "BUSINESS_OPERATING",
        status: "ACTIVE",
      },
    });
    if (!operatingAccount) continue;

    const createdByUserId = await findPayrollActorForCompany(employee.companyId);
    if (!createdByUserId) continue;

    await prisma.payrollRun.create({
      data: {
        companyId: employee.companyId,
        bankAccountId: operatingAccount.id,
        createdByUserId,
        label: `Auto payroll · ${employee.displayName}`,
        totalAmount: employee.payAmount,
        payDate: employee.nextPayDate,
        lineItems: [
          {
            employeeId: employee.id,
            displayName: employee.displayName,
            amount: Number(employee.payAmount.toString()),
            accountNumber: employee.accountNumber,
          },
        ],
        memo: `Scheduled ${employee.payDay.replaceAll("_", " ")} payroll`,
        status: "APPROVED",
        autoEmployeeId: employee.id,
      },
    });
  }
}

export async function executeDuePayrollRuns(
  options: ExecuteDuePayrollRunsOptions = {},
): Promise<ExecuteDuePayrollRunsResult> {
  const now = options.now ?? new Date();

  if (!options.runIds?.length) {
    await createAutoPayrollRunsForDueEmployees(now);
  }

  const runs = await prisma.payrollRun.findMany({
    where: {
      status: "APPROVED",
      payDate: { lte: now },
      ...(options.runIds?.length ? { id: { in: options.runIds } } : {}),
    },
    orderBy: { payDate: "asc" },
  });

  let executedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const run of runs) {
    const outcome = await executeSinglePayrollRun(run, run.payDate, now);
    if (outcome === "executed") executedCount += 1;
    else if (outcome === "failed") failedCount += 1;
    else skippedCount += 1;
  }

  return {
    dueCount: runs.length,
    executedCount,
    failedCount,
    skippedCount,
  };
}
