import type {
  DealRoomOfferStatus as DbOfferStatus,
  DealRoomOfferType as DbOfferType,
  DealRoomStatus as DbDealRoomStatus,
  Prisma,
} from "@prisma/client";
import type { AltaUser } from "@/lib/auth/types";
import {
  canAccessBankInternal,
  canManageBusinessTreasury,
  canNegotiateCompanyDealRoom,
  canViewCompanyDealRoom,
  isAdmin,
} from "@/lib/auth/permissions";
import type {
  CreateApplicantCounterOfferInput,
  CreateOfficerOfferInput,
  DealRoomOfferRow,
  DealRoomTermsContext,
  RejectDealRoomOfferInput,
} from "@/lib/bank/deal-room-types";
import { MAX_DEAL_ROOM_TERM_MONTHS } from "@/lib/bank/deal-room-types";
import { prisma } from "@/server/db";
import {
  dealRoomInclude,
  dealRoomOfferInclude,
  mapDealRoomOfferRow,
  type DealRoomRecord,
} from "@/server/deal-room-mapper";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";
import { writeAuditLog } from "@/server/audit.service";
import { insertDealRoomSystemUpdateInTx } from "@/server/deal-room.service";

function forbidden(): never {
  throw new Error("FORBIDDEN");
}

function notFound(): never {
  throw new Error("NOT_FOUND");
}

function badRequest(message: string): never {
  throw new Error(`BAD_REQUEST:${message}`);
}

async function getAltaUser(userId: string): Promise<AltaUser> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithMembershipsInclude,
  });
  if (!user) notFound();
  return mapDbUserToAltaUser(user);
}

function canManageDealRoomOps(user: AltaUser): boolean {
  return canAccessBankInternal(user);
}

function canViewDealRoom(user: AltaUser, room: Pick<DealRoomRecord, "borrowerUserId" | "companyId">): boolean {
  if (canAccessBankInternal(user)) return true;
  if (room.borrowerUserId === user.id) return true;
  if (room.companyId && canViewCompanyDealRoom(user, room.companyId)) return true;
  return false;
}

function canNegotiateDealRoom(user: AltaUser, room: DealRoomRecord): boolean {
  if (room.borrowerUserId === user.id) return true;
  if (room.companyId && canNegotiateCompanyDealRoom(user, room.companyId)) return true;
  return false;
}

const CLOSED_STATUSES: DbDealRoomStatus[] = ["DECLINED", "CLOSED", "EXECUTED"];

const POST_ACCEPTANCE_STATUSES: DbDealRoomStatus[] = [
  "CONTRACT_DRAFTING",
  "READY_FOR_ACCEPTANCE",
  "ACCEPTED",
  "APPROVED",
];

const NEGOTIATION_STATUSES: DbDealRoomStatus[] = [
  "UNDER_REVIEW",
  "NEGOTIATING_TERMS",
  "AWAITING_APPLICANT",
  "AWAITING_OFFICER",
];

function assertRoomAcceptsOffers(room: DealRoomRecord, user: AltaUser): void {
  if (room.status === "EXECUTED") {
    badRequest("This deal room has been successfully executed. No further offers are permitted.");
  }
  if (CLOSED_STATUSES.includes(room.status) && !canManageDealRoomOps(user)) {
    badRequest("This deal room is closed. Contact Alta to reopen negotiation.");
  }
  if (POST_ACCEPTANCE_STATUSES.includes(room.status) && !canManageDealRoomOps(user)) {
    badRequest("Terms have been accepted. No further offers unless Alta reopens the room.");
  }
  if (!NEGOTIATION_STATUSES.includes(room.status) && !canManageDealRoomOps(user)) {
    badRequest("This deal room is not open for term negotiation.");
  }
}

function validateOfferTerms(input: {
  proposedPrincipal: number;
  proposedInterestRate: number;
  proposedTermMonths: number;
}): void {
  if (input.proposedPrincipal <= 0) badRequest("Principal amount must be greater than zero.");
  if (input.proposedInterestRate < 0) badRequest("Interest rate cannot be negative.");
  if (input.proposedTermMonths < 1) badRequest("Term must be at least one month.");
  if (input.proposedTermMonths > MAX_DEAL_ROOM_TERM_MONTHS) {
    badRequest(`Term cannot exceed ${MAX_DEAL_ROOM_TERM_MONTHS} months.`);
  }
}

function offerIsExpired(offer: { expiresAt: Date | null; status: DbOfferStatus }): boolean {
  return offer.status === "EXPIRED" || (offer.expiresAt != null && offer.expiresAt <= new Date());
}

async function getDealRoomRecord(dealRoomId: string): Promise<DealRoomRecord> {
  const room = await prisma.dealRoom.findUnique({
    where: { id: dealRoomId },
    include: dealRoomInclude,
  });
  if (!room) notFound();
  return room;
}

async function assertCanViewDealRoom(userId: string, dealRoomId: string): Promise<{
  user: AltaUser;
  room: DealRoomRecord;
}> {
  const [user, room] = await Promise.all([getAltaUser(userId), getDealRoomRecord(dealRoomId)]);
  if (!canViewDealRoom(user, room)) forbidden();
  return { user, room };
}

async function getOfferRecord(offerId: string) {
  const offer = await prisma.dealRoomOffer.findUnique({
    where: { id: offerId },
    include: dealRoomOfferInclude,
  });
  if (!offer) notFound();
  return offer;
}

async function withdrawOtherSentOffersInTx(
  tx: Prisma.TransactionClient,
  dealRoomId: string,
  excludeOfferId: string,
  offerType?: DbOfferType,
): Promise<void> {
  const now = new Date();
  await tx.dealRoomOffer.updateMany({
    where: {
      dealRoomId,
      id: { not: excludeOfferId },
      status: "SENT",
      ...(offerType ? { offerType } : {}),
    },
    data: { status: "WITHDRAWN", withdrawnAt: now },
  });
}

async function writeOfferAudit(
  actorUserId: string,
  action: string,
  dealRoomId: string,
  offer: {
    id: string;
    offerType: DbOfferType;
    proposedPrincipal: Prisma.Decimal;
    proposedInterestRate: Prisma.Decimal;
    proposedTermMonths: number;
  },
  room: DealRoomRecord,
): Promise<void> {
  await writeAuditLog({
    actorUserId,
    action,
    entityType: "DEAL_ROOM",
    entityId: dealRoomId,
    targetUserId: room.borrowerUserId,
    targetCompanyId: room.companyId ?? undefined,
    description: `${action.replaceAll("_", " ").toLowerCase()} in deal room ${dealRoomId}.`,
    metadata: {
      dealRoomId,
      offerId: offer.id,
      offerType: offer.offerType,
      principal: Number(offer.proposedPrincipal),
      interestRate: Number(offer.proposedInterestRate),
      termMonths: offer.proposedTermMonths,
      actorUserId,
    },
  });
}

function buildOfferPermissions(
  user: AltaUser,
  room: DealRoomRecord,
  offer: DealRoomOfferRow,
): Pick<DealRoomOfferRow, "canAccept" | "canReject" | "canWithdraw"> {
  const isOps = canManageDealRoomOps(user);
  const canNegotiate = canNegotiateDealRoom(user, room);
  const active = offer.isActive;

  const canAccept =
    active &&
    ((offer.offerType === "officer_offer" && canNegotiate) ||
      (offer.offerType === "applicant_counter" && isOps));

  const canReject =
    active &&
    ((offer.offerType === "officer_offer" && canNegotiate) ||
      (offer.offerType === "applicant_counter" && isOps));

  const canWithdraw =
    active &&
    (offer.createdByUserId === user.id || isOps);

  return { canAccept, canReject, canWithdraw };
}

export async function getDealRoomOffers(
  actorUserId: string,
  dealRoomId: string,
): Promise<{ offers: DealRoomOfferRow[]; termsContext: DealRoomTermsContext }> {
  const { user, room } = await assertCanViewDealRoom(actorUserId, dealRoomId);

  const offers = await prisma.dealRoomOffer.findMany({
    where: { dealRoomId },
    include: dealRoomOfferInclude,
    orderBy: { createdAt: "desc" },
  });

  const mapped = offers.map((o) => {
    const row = mapDealRoomOfferRow(o);
    return { ...row, ...buildOfferPermissions(user, room, row) };
  });

  const activeOffer = mapped.find((o) => o.isActive) ?? null;
  const canNegotiate = canNegotiateDealRoom(user, room);
  const isOps = canManageDealRoomOps(user);
  const roomOpen =
    !CLOSED_STATUSES.includes(room.status) && !POST_ACCEPTANCE_STATUSES.includes(room.status);

  const termsContext: DealRoomTermsContext = {
    requestedAmount: Number(room.currentRequestedAmount),
    requestedTermMonths: room.loanApplication?.termMonths ?? room.currentProposedTermMonths ?? 12,
    requestedPaymentStructure: room.loanApplication?.repaymentPlan ?? null,
    currentProposedAmount: room.currentProposedAmount != null ? Number(room.currentProposedAmount) : null,
    currentProposedRate: room.currentProposedRate != null ? Number(room.currentProposedRate) : null,
    currentProposedTermMonths: room.currentProposedTermMonths,
    acceptedTerms:
      room.acceptedOfferId && room.acceptedAt
        ? {
            principal: Number(room.acceptedPrincipal ?? 0),
            interestRate: Number(room.acceptedInterestRate ?? 0),
            termMonths: room.acceptedTermMonths ?? 0,
            minimumPayment:
              room.acceptedMinimumPayment != null ? Number(room.acceptedMinimumPayment) : null,
            paymentFrequency: room.acceptedPaymentFrequency,
            collateralDescription: room.acceptedCollateralDescription,
            specialConditions: room.acceptedSpecialConditions,
            acceptedOfferId: room.acceptedOfferId,
            acceptedAt: room.acceptedAt.toISOString(),
          }
        : null,
    activeOffer,
    canCreateCounterOffer: canNegotiate && roomOpen && activeOffer?.offerType === "officer_offer",
    canCreateOfficerOffer: isOps && roomOpen,
  };

  return { offers: mapped, termsContext };
}

export async function createOfficerOffer(
  actorUserId: string,
  input: CreateOfficerOfferInput,
): Promise<DealRoomOfferRow> {
  const actor = await getAltaUser(actorUserId);
  if (!canManageDealRoomOps(actor)) forbidden();

  const room = await getDealRoomRecord(input.dealRoomId);
  assertRoomAcceptsOffers(room, actor);
  validateOfferTerms(input);

  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) badRequest("Invalid expiration date.");

  const offer = await prisma.$transaction(async (tx) => {
    const created = await tx.dealRoomOffer.create({
      data: {
        dealRoomId: input.dealRoomId,
        createdByUserId: actorUserId,
        offerType: "OFFICER_OFFER",
        status: "SENT",
        proposedPrincipal: input.proposedPrincipal,
        proposedInterestRate: input.proposedInterestRate,
        proposedTermMonths: input.proposedTermMonths,
        proposedMinimumPayment: input.proposedMinimumPayment ?? null,
        proposedPaymentFrequency: input.proposedPaymentFrequency?.trim() || null,
        collateralDescription: input.collateralDescription?.trim() || null,
        specialConditions: input.specialConditions?.trim() || null,
        expiresAt,
      },
      include: dealRoomOfferInclude,
    });

    await withdrawOtherSentOffersInTx(tx, input.dealRoomId, created.id, "OFFICER_OFFER");

    await tx.dealRoom.update({
      where: { id: input.dealRoomId },
      data: {
        status: "AWAITING_APPLICANT",
        currentProposedAmount: input.proposedPrincipal,
        currentProposedRate: input.proposedInterestRate,
        currentProposedTermMonths: input.proposedTermMonths,
        updatedAt: new Date(),
      },
    });

    await insertDealRoomSystemUpdateInTx(tx, input.dealRoomId, "Alta issued a new term offer.", {
      metadata: { offerId: created.id, offerType: "OFFICER_OFFER" },
      actorUserId,
    });

    return created;
  });

  await writeOfferAudit(actorUserId, "DEAL_ROOM_OFFER_CREATED", input.dealRoomId, offer, room);

  const row = mapDealRoomOfferRow(offer);
  return { ...row, ...buildOfferPermissions(actor, room, row) };
}

export async function createApplicantCounterOffer(
  actorUserId: string,
  input: CreateApplicantCounterOfferInput,
): Promise<DealRoomOfferRow> {
  const { user, room } = await assertCanViewDealRoom(actorUserId, input.dealRoomId);
  if (!canNegotiateDealRoom(user, room)) forbidden();
  assertRoomAcceptsOffers(room, user);
  validateOfferTerms(input);

  const offer = await prisma.$transaction(async (tx) => {
    const created = await tx.dealRoomOffer.create({
      data: {
        dealRoomId: input.dealRoomId,
        createdByUserId: actorUserId,
        offerType: "APPLICANT_COUNTER",
        status: "SENT",
        proposedPrincipal: input.proposedPrincipal,
        proposedInterestRate: input.proposedInterestRate,
        proposedTermMonths: input.proposedTermMonths,
        proposedMinimumPayment: input.proposedMinimumPayment ?? null,
        proposedPaymentFrequency: input.proposedPaymentFrequency?.trim() || null,
        collateralDescription: input.collateralDescription?.trim() || null,
        specialConditions: input.specialConditions?.trim() || null,
      },
      include: dealRoomOfferInclude,
    });

    await withdrawOtherSentOffersInTx(tx, input.dealRoomId, created.id, "APPLICANT_COUNTER");

    await tx.dealRoom.update({
      where: { id: input.dealRoomId },
      data: {
        status: "AWAITING_OFFICER",
        currentRequestedAmount: input.proposedPrincipal,
        updatedAt: new Date(),
      },
    });

    if (room.companyId && room.borrowerUserId !== actorUserId) {
      await tx.dealRoomParticipant.upsert({
        where: {
          dealRoomId_userId_role: {
            dealRoomId: input.dealRoomId,
            userId: actorUserId,
            role: "COMPANY_REPRESENTATIVE",
          },
        },
        create: {
          dealRoomId: input.dealRoomId,
          userId: actorUserId,
          role: "COMPANY_REPRESENTATIVE",
        },
        update: {},
      });
    }

    await insertDealRoomSystemUpdateInTx(tx, input.dealRoomId, "Applicant submitted a counter-offer.", {
      metadata: { offerId: created.id, offerType: "APPLICANT_COUNTER" },
      actorUserId,
    });

    return created;
  });

  await writeOfferAudit(
    actorUserId,
    "DEAL_ROOM_COUNTER_OFFER_CREATED",
    input.dealRoomId,
    offer,
    room,
  );

  const row = mapDealRoomOfferRow(offer);
  return { ...row, ...buildOfferPermissions(user, room, row) };
}

export async function acceptDealRoomOffer(
  offerId: string,
  actorUserId: string,
): Promise<DealRoomOfferRow> {
  const offer = await getOfferRecord(offerId);
  const { user, room } = await assertCanViewDealRoom(actorUserId, offer.dealRoomId);

  if (offer.status !== "SENT") badRequest("Only active sent offers can be accepted.");
  if (offerIsExpired(offer)) badRequest("This offer has expired.");
  if (room.acceptedOfferId) badRequest("Terms have already been accepted for this deal room.");

  const row = mapDealRoomOfferRow(offer);
  const perms = buildOfferPermissions(user, room, row);
  if (!perms.canAccept) forbidden();

  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    await tx.dealRoomOffer.updateMany({
      where: {
        dealRoomId: offer.dealRoomId,
        id: { not: offerId },
        status: "SENT",
      },
      data: { status: "WITHDRAWN", withdrawnAt: now },
    });

    const accepted = await tx.dealRoomOffer.update({
      where: { id: offerId },
      data: { status: "ACCEPTED", acceptedAt: now },
      include: dealRoomOfferInclude,
    });

    await tx.dealRoom.update({
      where: { id: offer.dealRoomId },
      data: {
        status: "CONTRACT_DRAFTING",
        acceptedOfferId: offerId,
        acceptedAt: now,
        acceptedPrincipal: offer.proposedPrincipal,
        acceptedInterestRate: offer.proposedInterestRate,
        acceptedTermMonths: offer.proposedTermMonths,
        acceptedMinimumPayment: offer.proposedMinimumPayment,
        acceptedPaymentFrequency: offer.proposedPaymentFrequency,
        acceptedCollateralDescription: offer.collateralDescription,
        acceptedSpecialConditions: offer.specialConditions,
        currentProposedAmount: offer.proposedPrincipal,
        currentProposedRate: offer.proposedInterestRate,
        currentProposedTermMonths: offer.proposedTermMonths,
        updatedAt: now,
      },
    });

    await insertDealRoomSystemUpdateInTx(tx, offer.dealRoomId, "Term offer accepted.", {
      metadata: { offerId, offerType: offer.offerType },
      actorUserId,
      updateStatus: "CONTRACT_DRAFTING",
    });

    await insertDealRoomSystemUpdateInTx(tx, offer.dealRoomId, "Deal moved to contract drafting.", {
      metadata: { offerId },
      actorUserId,
    });

    return accepted;
  });

  await writeOfferAudit(actorUserId, "DEAL_ROOM_OFFER_ACCEPTED", offer.dealRoomId, updated, room);
  await writeOfferAudit(actorUserId, "DEAL_ROOM_TERMS_ACCEPTED", offer.dealRoomId, updated, room);

  const mapped = mapDealRoomOfferRow(updated);
  return { ...mapped, ...buildOfferPermissions(user, room, mapped) };
}

export async function rejectDealRoomOffer(
  actorUserId: string,
  input: RejectDealRoomOfferInput,
): Promise<DealRoomOfferRow> {
  const offer = await getOfferRecord(input.offerId);
  const { user, room } = await assertCanViewDealRoom(actorUserId, offer.dealRoomId);

  if (offer.status !== "SENT") badRequest("Only active sent offers can be rejected.");
  if (offerIsExpired(offer)) badRequest("This offer has expired.");

  const row = mapDealRoomOfferRow(offer);
  const perms = buildOfferPermissions(user, room, row);
  if (!perms.canReject) forbidden();

  const rejectionNote = input.rejectionNote?.trim() || null;
  const now = new Date();

  const nextStatus: DbDealRoomStatus =
    offer.offerType === "OFFICER_OFFER" ? "AWAITING_OFFICER" : "AWAITING_APPLICANT";

  const updated = await prisma.$transaction(async (tx) => {
    const rejected = await tx.dealRoomOffer.update({
      where: { id: input.offerId },
      data: {
        status: "REJECTED",
        rejectedAt: now,
        rejectionNote,
      },
      include: dealRoomOfferInclude,
    });

    await tx.dealRoom.update({
      where: { id: offer.dealRoomId },
      data: { status: nextStatus, updatedAt: now },
    });

    await insertDealRoomSystemUpdateInTx(tx, offer.dealRoomId, "Term offer rejected.", {
      metadata: { offerId: input.offerId, rejectionNote },
      actorUserId,
      updateStatus: nextStatus,
    });

    return rejected;
  });

  await writeOfferAudit(actorUserId, "DEAL_ROOM_OFFER_REJECTED", offer.dealRoomId, updated, room);

  const mapped = mapDealRoomOfferRow(updated);
  return { ...mapped, ...buildOfferPermissions(user, room, mapped) };
}

export async function withdrawDealRoomOffer(
  offerId: string,
  actorUserId: string,
): Promise<DealRoomOfferRow> {
  const offer = await getOfferRecord(offerId);
  const { user, room } = await assertCanViewDealRoom(actorUserId, offer.dealRoomId);

  if (offer.status !== "SENT") badRequest("Only active sent offers can be withdrawn.");

  const row = mapDealRoomOfferRow(offer);
  const perms = buildOfferPermissions(user, room, row);
  if (!perms.canWithdraw) forbidden();

  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const withdrawn = await tx.dealRoomOffer.update({
      where: { id: offerId },
      data: { status: "WITHDRAWN", withdrawnAt: now },
      include: dealRoomOfferInclude,
    });

    await tx.dealRoom.update({
      where: { id: offer.dealRoomId },
      data: { updatedAt: now },
    });

    await insertDealRoomSystemUpdateInTx(tx, offer.dealRoomId, "Term offer withdrawn.", {
      metadata: { offerId },
      actorUserId,
    });

    return withdrawn;
  });

  await writeOfferAudit(actorUserId, "DEAL_ROOM_OFFER_WITHDRAWN", offer.dealRoomId, updated, room);

  const mapped = mapDealRoomOfferRow(updated);
  return { ...mapped, ...buildOfferPermissions(user, room, mapped) };
}
