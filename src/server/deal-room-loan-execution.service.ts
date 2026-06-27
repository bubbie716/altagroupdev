import { randomBytes } from "node:crypto";
import type { AgreementFieldData } from "@/lib/agreements/agreement-types";
import {
  parseAgreementLoanTerms,
  validateParsedAgreementTerms,
} from "@/lib/agreements/parse-agreement-terms";
import type {
  DealRoomExecutionSummary,
  LoanExecutionResult,
} from "@/lib/lending/loan-execution-types";
import { LOAN_PRODUCT_LABELS, type LoanProductTypeCode } from "@/lib/bank/lending-types";
import {
  canAccessInternal,
  canViewCompanyDealRoom,
  isPrivateClient,
} from "@/lib/auth/permissions";
import type { AltaUser } from "@/lib/auth/types";
import {
  createLoanInterestScheduleInTx,
  roundCurrency,
} from "@/lib/bank/loan-interest-service";
import { prisma } from "@/server/db";
import { writeAuditLog } from "@/server/audit.service";
import { insertDealRoomSystemUpdateInTx } from "@/server/deal-room.service";
import { dealRoomInclude } from "@/server/deal-room-mapper";
import { loanApplicationReviewInclude } from "@/server/lending-mapper";
import { createLedgerEntry, createLoanPaymentScheduleInTx } from "@/server/loan.service";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

function generateReferenceCode(prefix: "LND" | "LNP" | "LNI"): string {
  return `${prefix}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

const PRODUCT_TYPE_LABELS: Record<string, LoanProductTypeCode> = {
  PERSONAL_CREDIT_LINE: "personal_credit_line",
  BUSINESS_CREDIT_LINE: "business_credit_line",
  PRIVATE_LIQUIDITY_LINE: "private_liquidity_line",
};

export type ExecuteFromAgreementInput = {
  actorUserId: string;
  dealRoomId: string;
  agreementId: string;
  draftId: string;
  draftVersion: number;
  templateSlug: string;
  fieldData: AgreementFieldData;
  executedPdf: {
    storageKey: string;
    sha256: string;
    fileSizeBytes: number;
  };
  bankSignatureName: string;
  bankSignatureDiscordId: string | null;
  bankSignatureIp: string | null;
};

function ledgerDescription(
  base: string,
  ctx: { loanId: string; agreementId: string; dealRoomId: string },
): string {
  return `${base} · Loan ${ctx.loanId.slice(0, 8)} · Agreement ${ctx.agreementId.slice(0, 8)} · Deal ${ctx.dealRoomId.slice(0, 8)}`;
}

async function writeExecutionAudit(
  actorUserId: string,
  action: string,
  meta: {
    loanId: string;
    agreementId: string;
    dealRoomId: string;
    agreementDraftId: string;
    borrowerUserId: string;
    companyId?: string | null;
    officerUserId?: string | null;
    disbursementReference?: string | null;
    fundingAccountId?: string | null;
  },
): Promise<void> {
  await writeAuditLog({
    actorUserId,
    action,
    entityType: action.startsWith("DEAL_ROOM") ? "DEAL_ROOM" : "LOAN",
    entityId: action.startsWith("DEAL_ROOM") ? meta.dealRoomId : meta.loanId,
    targetUserId: meta.borrowerUserId,
    targetCompanyId: meta.companyId ?? undefined,
    targetLoanId: meta.loanId,
    targetAccountId: meta.fundingAccountId ?? undefined,
    description: `${action.replaceAll("_", " ").toLowerCase()} for deal room ${meta.dealRoomId.slice(0, 8)}.`,
    metadata: {
      loanId: meta.loanId,
      agreementId: meta.agreementId,
      agreementDraftId: meta.agreementDraftId,
      dealRoomId: meta.dealRoomId,
      officerUserId: meta.officerUserId ?? null,
      disbursementReference: meta.disbursementReference ?? null,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Atomically converts a fully-signed executed agreement into an active loan.
 * Agreement field data is the sole source of loan terms.
 */
export async function executeLoanFromExecutedAgreement(
  input: ExecuteFromAgreementInput,
): Promise<LoanExecutionResult> {
  const {
    actorUserId,
    dealRoomId,
    agreementId,
    draftId,
    draftVersion,
    templateSlug,
    fieldData,
    executedPdf,
    bankSignatureName,
    bankSignatureDiscordId,
    bankSignatureIp,
  } = input;

  const room = await prisma.dealRoom.findUnique({
    where: { id: dealRoomId },
    include: {
      ...dealRoomInclude,
      agreement: true,
      loanApplication: { include: loanApplicationReviewInclude },
    },
  });
  if (!room) notFound();

  if (room.executedLoanId) badRequest("This deal room has already been executed.");
  if (room.status === "EXECUTED") badRequest("Deal room is already in executed status.");
  if (!room.loanApplication) badRequest("Deal room is not linked to a loan application.");
  if (room.loanApplication.loan) badRequest("A loan already exists for this application.");

  const draft = await prisma.dealRoomAgreementDraft.findUnique({
    where: { id: draftId },
    include: { signatures: true, agreement: true },
  });
  if (!draft) notFound();
  if (draft.agreementId !== agreementId) badRequest("Draft does not belong to this agreement.");
  if (draft.status === "EXECUTED") badRequest("This agreement draft has already been executed.");
  if (draft.status !== "AWAITING_BANK") {
    badRequest("Agreement must have borrower signature and await Alta Bank signature.");
  }

  const borrowerSig = draft.signatures.find((s) => s.party === "BORROWER");
  if (!borrowerSig) badRequest("Borrower signature is required before execution.");

  const existingBankSig = draft.signatures.find((s) => s.party === "BANK");
  if (existingBankSig) badRequest("Alta Bank has already signed this draft.");

  if (room.agreement?.executedDraftId) {
    badRequest("An agreement has already been executed for this deal room.");
  }

  const existingLoanByDraft = await prisma.loan.findUnique({
    where: { sourceAgreementDraftId: draftId },
  });
  if (existingLoanByDraft) badRequest("A loan has already been created from this agreement draft.");

  const terms = parseAgreementLoanTerms(fieldData, templateSlug);
  validateParsedAgreementTerms(terms);

  const application = room.loanApplication;
  const destinationAccountId = application.linkedBankAccountId;
  if (!destinationAccountId) {
    badRequest("Destination disbursement account must be selected during underwriting.");
  }

  const applicant = mapDbUserToAltaUser(application.applicantUser);
  if (terms.productType === "BUSINESS_CREDIT_LINE") {
    if (!room.companyId || application.company?.verificationStatus !== "VERIFIED") {
      badRequest("Business loans require a verified company.");
    }
  }
  if (terms.productType === "PRIVATE_LIQUIDITY_LINE" && !isPrivateClient(applicant)) {
    badRequest("Applicant must have Alta Private client status.");
  }

  const now = new Date();
  const officerId = room.assignedOfficerId ?? actorUserId;
  const borrowerUserId =
    terms.productType === "BUSINESS_CREDIT_LINE" ? null : room.borrowerUserId;

  let loanId = "";
  let disbursementReferenceCode: string | null = null;
  let scheduleCount = 0;

  await prisma.$transaction(async (tx) => {
    await tx.dealRoomAgreementSignature.create({
      data: {
        draftId,
        party: "BANK",
        userId: actorUserId,
        signatureName: bankSignatureName.trim(),
        discordId: bankSignatureDiscordId,
        ipAddress: bankSignatureIp,
      },
    });

    const account = await tx.bankAccount.findUnique({ where: { id: destinationAccountId } });
    if (!account) badRequest("Destination disbursement account not found.");
    if (account.status === "FROZEN" || account.status === "CLOSED") {
      badRequest("Cannot disburse to a frozen or closed account.");
    }

    const loan = await tx.loan.create({
      data: {
        loanApplicationId: application.id,
        borrowerUserId,
        companyId: room.companyId,
        productType: terms.productType,
        principalAmount: terms.principalAmount,
        termMonths: terms.termMonths,
        outstandingBalance: terms.principalAmount,
        principalOutstanding: terms.principalAmount,
        accruedInterest: 0,
        interestRate: terms.interestRate,
        interestRateType: "MONTHLY_PERCENT",
        lastInterestAccruedAt: now,
        nextInterestAccrualAt: terms.firstPaymentDueDate,
        firstPaymentDueDate: terms.firstPaymentDueDate,
        maturityDate: terms.maturityDate,
        status: "ACTIVE",
        linkedBankAccountId: destinationAccountId,
        approvedById: officerId,
        approvedAt: now,
        sourceDealRoomId: dealRoomId,
        sourceAgreementId: agreementId,
        sourceAgreementDraftId: draftId,
        collateralDescription: terms.collateralDescription || null,
        paymentFrequencyLabel: terms.paymentFrequency,
        minimumPayment: terms.minimumPayment,
      },
    });
    loanId = loan.id;

    const auditCtx = { loanId, agreementId, dealRoomId };

    await tx.loanApplication.update({
      where: { id: application.id },
      data: { status: "APPROVED", reviewedById: officerId, reviewedAt: now },
    });

    disbursementReferenceCode = generateReferenceCode("LND");
    const bankTx = await tx.bankTransaction.create({
      data: {
        bankAccountId: destinationAccountId,
        type: "ADJUSTMENT",
        amount: terms.principalAmount,
        status: "APPROVED",
        description: `Loan funding · Agreement ${fieldData.loanId}`,
        memo: `Alta Bank loan disbursement · Deal ${dealRoomId.slice(0, 8)}`,
        referenceCode: disbursementReferenceCode,
        reviewedById: actorUserId,
        reviewedAt: now,
      },
    });

    await tx.bankAccount.update({
      where: { id: destinationAccountId },
      data: { balance: { increment: terms.principalAmount } },
    });

    await tx.loan.update({
      where: { id: loan.id },
      data: { disbursementReferenceCode },
    });

    await createLedgerEntry(tx, {
      loanId: loan.id,
      type: "DISBURSEMENT",
      amount: terms.principalAmount,
      balanceAfter: terms.principalAmount,
      description: ledgerDescription("Loan receivable established — principal disbursed", auditCtx),
      bankTransactionId: bankTx.id,
      createdById: actorUserId,
    });

    await createLoanPaymentScheduleInTx(
      tx,
      loan.id,
      terms.principalAmount,
      terms.termMonths,
      terms.firstPaymentDueDate,
      terms.interestRate,
      "MONTHLY_PERCENT",
    );

    const scheduleItems = await tx.loanPaymentScheduleItem.count({ where: { loanId: loan.id } });
    scheduleCount = scheduleItems;

    const { firstGuaranteedInterest } = await createLoanInterestScheduleInTx(
      tx,
      loan.id,
      terms.principalAmount,
      terms.termMonths,
      now,
      terms.interestRate,
      "MONTHLY_PERCENT",
    );

    if (firstGuaranteedInterest > 0) {
      const newPayoff = roundCurrency(terms.principalAmount + firstGuaranteedInterest);
      await tx.loan.update({
        where: { id: loan.id },
        data: {
          accruedInterest: firstGuaranteedInterest,
          outstandingBalance: newPayoff,
        },
      });

      await createLedgerEntry(tx, {
        loanId: loan.id,
        type: "INTEREST_CHARGE",
        amount: firstGuaranteedInterest,
        balanceAfter: newPayoff,
        description: ledgerDescription("Month 1 interest guaranteed at funding", auditCtx),
        createdById: actorUserId,
      });
    }

    await tx.dealRoomAgreementDraft.update({
      where: { id: draftId },
      data: {
        status: "EXECUTED",
        executedAt: now,
        pdfStorageKey: executedPdf.storageKey,
        pdfSha256: executedPdf.sha256,
      },
    });

    await tx.dealRoomAgreement.update({
      where: { id: agreementId },
      data: { executedDraftId: draftId, activeDraftId: draftId },
    });

    await tx.dealRoom.update({
      where: { id: dealRoomId },
      data: {
        status: "EXECUTED",
        workflowStage: "COMPLETED",
        executedLoanId: loanId,
        closedAt: now,
        updatedAt: now,
        slaBankSignedAt: now,
        slaFundingCompletedAt: now,
      },
    });

    await tx.dealRoomDocument.create({
      data: {
        dealRoomId,
        uploadedByUserId: actorUserId,
        documentType: "SIGNED_CONTRACT",
        visibility: "SHARED",
        originalFileName: `Executed Loan Agreement V${draftVersion}.pdf`,
        storedFileName: `executed-agreement-v${draftVersion}.pdf`,
        mimeType: "application/pdf",
        fileSizeBytes: executedPdf.fileSizeBytes,
        storageKey: executedPdf.storageKey,
        description: "Executed loan agreement",
        status: "ACTIVE",
      },
    });

    await insertDealRoomSystemUpdateInTx(tx, dealRoomId, "Alta Bank signed agreement.", {
      metadata: { draftId },
      actorUserId,
    });
    await insertDealRoomSystemUpdateInTx(tx, dealRoomId, "Agreement executed.", {
      metadata: { draftId, loanId },
      actorUserId,
      updateStatus: "EXECUTED",
    });
    await insertDealRoomSystemUpdateInTx(tx, dealRoomId, "Loan created from executed agreement.", {
      metadata: { loanId, agreementId },
      actorUserId,
    });
    await insertDealRoomSystemUpdateInTx(tx, dealRoomId, "Funds disbursed to destination account.", {
      metadata: { loanId, referenceCode: disbursementReferenceCode, accountId: destinationAccountId },
      actorUserId,
    });
    await insertDealRoomSystemUpdateInTx(tx, dealRoomId, "Repayment schedule generated.", {
      metadata: { loanId, installments: scheduleCount },
      actorUserId,
    });
    await insertDealRoomSystemUpdateInTx(
      tx,
      dealRoomId,
      "First payment scheduled.",
      { metadata: { loanId, dueDate: terms.firstPaymentDueDate.toISOString() }, actorUserId },
    );
  });

  const auditBase = {
    loanId,
    agreementId,
    dealRoomId,
    agreementDraftId: draftId,
    borrowerUserId: room.borrowerUserId,
    companyId: room.companyId,
    officerUserId: officerId,
    disbursementReference: disbursementReferenceCode,
    fundingAccountId: destinationAccountId,
  };

  await Promise.all([
    writeExecutionAudit(actorUserId, "LOAN_CREATED", auditBase),
    writeExecutionAudit(actorUserId, "LOAN_FUNDED", auditBase),
    writeExecutionAudit(actorUserId, "LOAN_DISBURSED", auditBase),
    writeExecutionAudit(actorUserId, "LOAN_PAYMENT_SCHEDULE_GENERATED", auditBase),
    writeExecutionAudit(actorUserId, "DEAL_ROOM_EXECUTED", auditBase),
    writeExecutionAudit(actorUserId, "ACCOUNT_CREDITED", auditBase),
    writeExecutionAudit(actorUserId, "LEDGER_ENTRY_CREATED", auditBase),
    writeExecutionAudit(actorUserId, "DEAL_ROOM_AGREEMENT_BANK_SIGNED", auditBase),
  ]);

  const { notifyDealRoomStakeholders } = await import("@/server/deal-room-ops.service");
  await notifyDealRoomStakeholders(
    dealRoomId,
    "DEAL_ROOM_FUNDING_COMPLETE",
    "Loan funded",
    "Your facility has been accepted and funds have been disbursed.",
    room.loanApplicationId
      ? `/bank/lending/loans`
      : `/bank/lending/applications`,
  );

  return {
    loanId,
    dealRoomId,
    agreementId,
    agreementDraftId: draftId,
    disbursementReferenceCode,
    fundingBankAccountId: destinationAccountId,
    scheduleInstallmentCount: scheduleCount,
    firstPaymentDueDate: terms.firstPaymentDueDate.toISOString(),
  };
}

export async function getDealRoomExecutionSummary(
  actorUserId: string,
  dealRoomId: string,
): Promise<DealRoomExecutionSummary | null> {
  const user = await prisma.user.findUnique({
    where: { id: actorUserId },
    include: userWithMembershipsInclude,
  });
  if (!user) notFound();
  const altaUser = mapDbUserToAltaUser(user);

  const room = await prisma.dealRoom.findUnique({
    where: { id: dealRoomId },
    include: {
      agreement: {
        include: {
          executedDraft: true,
        },
      },
      executedLoan: {
        include: {
          linkedBankAccount: { select: { id: true, accountNumber: true, accountName: true } },
          paymentSchedule: { orderBy: { dueDate: "asc" }, take: 1 },
        },
      },
      assignedOfficer: { select: { id: true, discordUsername: true } },
      borrowerUser: { select: { discordUsername: true } },
    },
  });
  if (!room) notFound();

  const canView =
    canAccessInternal(altaUser) ||
    room.borrowerUserId === actorUserId ||
    (room.companyId != null && canViewCompanyDealRoom(altaUser, room.companyId));
  if (!canView) return null;

  if (room.status !== "EXECUTED" || !room.executedLoan) {
    return null;
  }

  const loan = room.executedLoan;
  const draft = room.agreement?.executedDraft;
  const productCode = PRODUCT_TYPE_LABELS[loan.productType] ?? "personal_credit_line";
  const nextDue = loan.paymentSchedule[0];

  return {
    isExecuted: true,
    executedAt: draft?.executedAt?.toISOString() ?? room.closedAt?.toISOString() ?? null,
    loanId: loan.id,
    agreementId: room.agreement?.id ?? null,
    agreementDraftId: draft?.id ?? null,
    agreementVersion: draft?.versionNumber ?? null,
    agreementDownloadUrl: draft?.id
      ? `/api/deal-rooms/agreement-drafts/${draft.id}/download`
      : null,
    agreementSha256: draft?.pdfSha256 ?? null,
    disbursementReference: loan.disbursementReferenceCode,
    fundingAccountId: loan.linkedBankAccountId,
    fundingAccountLabel: loan.linkedBankAccount
      ? `${loan.linkedBankAccount.accountName} · ${loan.linkedBankAccount.accountNumber}`
      : null,
    officerId: room.assignedOfficerId,
    officerName: room.assignedOfficer?.discordUsername ?? null,
    borrowerName: room.borrowerUser.discordUsername,
    principal: Number(loan.principalAmount),
    interestRate: Number(loan.interestRate),
    termMonths: loan.termMonths ?? 0,
    monthlyPayment: loan.minimumPayment != null ? Number(loan.minimumPayment) : 0,
    nextDueDate: nextDue?.dueDate.toISOString() ?? loan.firstPaymentDueDate?.toISOString() ?? null,
    productLabel: LOAN_PRODUCT_LABELS[productCode],
    userLoanUrl: "/bank/lending/loans",
    internalLoanUrl: `/internal/lending/loans/${loan.id}`,
  };
}

export function assertDealRoomNotExecuted(status: string): void {
  if (status === "EXECUTED") {
    badRequest("This deal room has been successfully executed. No further changes are permitted.");
  }
}
