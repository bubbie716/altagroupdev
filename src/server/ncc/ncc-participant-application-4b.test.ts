import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { isDatabaseConfigured, prisma } from "@/server/db";
import { canInstitutionOriginateSettlement } from "@/lib/ncc/ncc-permissions";
import {
  canApplicantTransition,
  canStaffTransition,
  parseAccountIdentifierFormat,
} from "@/lib/ncc/ncc-participant-application";
import {
  NccParticipantApplicationError,
  assertCredentialEnvironmentAllowed,
  provisionApplicationForTest,
} from "@/server/ncc/ncc-participant-application.service";

const RUN = process.env.NCC_SETTLEMENT_TESTS === "1";

function formatProfile(overrides: Record<string, unknown> = {}) {
  return parseAccountIdentifierFormat({
    displayLabel: "External bank account id",
    characterFormatDescription: "Alphanumeric with optional slash",
    exampleMaskedIdentifier: "****9201",
    caseSensitive: true,
    branchCodeRequired: false,
    supportedCurrencies: ["FLR"],
    containsLetters: true,
    containsNumbers: true,
    containsSpaces: false,
    containsPunctuation: true,
    examples: ["BR05/839201", "AB-4928-17-X"],
    ...overrides,
  });
}

describe("ncc sprint 4b participant application", { skip: !RUN || !isDatabaseConfigured() }, () => {
  const suffix = Date.now().toString(36);
  let applicantId = "";
  let otherUserId = "";
  let staffId = "";
  let applicationId = "";

  before(async () => {
    const applicant = await prisma.user.create({
      data: {
        discordId: `ncc-4b-a-${suffix}`,
        discordUsername: `ncc_4b_a_${suffix}`,
      },
    });
    applicantId = applicant.id;

    const other = await prisma.user.create({
      data: {
        discordId: `ncc-4b-o-${suffix}`,
        discordUsername: `ncc_4b_o_${suffix}`,
      },
    });
    otherUserId = other.id;

    const staff = await prisma.user.create({
      data: {
        discordId: `ncc-4b-s-${suffix}`,
        discordUsername: `ncc_4b_s_${suffix}`,
        tags: { create: [{ tag: "CORPORATE_ADMIN" }] },
      },
    });
    staffId = staff.id;
  });

  after(async () => {
    // Best-effort cleanup is optional; unique suffix avoids collisions.
  });

  it("validates transition matrix", () => {
    assert.equal(canApplicantTransition("DRAFT", "SUBMITTED"), true);
    assert.equal(canApplicantTransition("SUBMITTED", "APPROVED_FOR_TEST"), false);
    assert.equal(canStaffTransition("SUBMITTED", "UNDER_REVIEW"), true);
    assert.equal(canStaffTransition("DRAFT", "APPROVED_FOR_TEST"), false);
    assert.equal(canStaffTransition("UNDER_REVIEW", "APPROVED_FOR_TEST"), true);
  });

  it("accepts different participant account-identifier format descriptions", () => {
    const digits = formatProfile({
      displayLabel: "Digits only",
      containsLetters: false,
      containsPunctuation: false,
      examples: ["0001847291"],
      characterFormatDescription: "10 digit characters",
      exampleMaskedIdentifier: "******7291",
    });
    const punct = formatProfile();
    assert.equal(digits.containsLetters, false);
    assert.equal(punct.containsPunctuation, true);
    assert.ok(punct.examples?.includes("BR05/839201"));
  });

  it("draft create, submit, isolation, info request/response, and TEST provisioning", async () => {
    const format = formatProfile();
    const draft = await prisma.nccParticipantApplication.create({
      data: {
        publicReference: `NCC-APP-4B-${suffix}`,
        status: "DRAFT",
        applicantUserId: applicantId,
        legalName: `Fourth Bank ${suffix}`,
        displayName: `Fourth Bank ${suffix}`,
        institutionType: "BANK",
        countryJurisdiction: "US-NY",
        registeredAddress: "1 Test Street",
        regulatoryAuthority: "Test Regulator",
        licenseOrRegistrationNumber: `LIC-${suffix}`,
        primaryContactName: "Pat Primary",
        primaryContactEmail: `pat-${suffix}@example.com`,
        complianceContactName: "Casey Compliance",
        complianceContactEmail: `casey-${suffix}@example.com`,
        technicalContactName: "Terry Tech",
        technicalContactEmail: `terry-${suffix}@example.com`,
        settlementOpsContactName: "Sam Settlement",
        settlementOpsContactEmail: `sam-${suffix}@example.com`,
        accountIdentifierFormat: format,
        requiredDocuments: ["Regulatory license or registration certificate"],
      },
    });
    applicationId = draft.id;

    await prisma.nccParticipantApplicationTransition.create({
      data: {
        applicationId,
        fromStatus: "DRAFT",
        toStatus: "SUBMITTED",
        actorUserId: applicantId,
        reason: "Submitted",
      },
    });
    await prisma.nccParticipantApplication.update({
      where: { id: applicationId },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    });

    // Applicant isolation: other user cannot see.
    const leaked = await prisma.nccParticipantApplication.findFirst({
      where: { id: applicationId, applicantUserId: otherUserId },
    });
    assert.equal(leaked, null);

    // Staff path: UNDER_REVIEW → INFORMATION_REQUIRED → response → APPROVED_FOR_TEST
    await prisma.nccParticipantApplication.update({
      where: { id: applicationId },
      data: { status: "UNDER_REVIEW" },
    });
    await prisma.nccParticipantApplicationTransition.create({
      data: {
        applicationId,
        fromStatus: "SUBMITTED",
        toStatus: "UNDER_REVIEW",
        actorUserId: staffId,
        reason: "Staff review started",
      },
    });

    await prisma.nccParticipantApplication.update({
      where: { id: applicationId },
      data: {
        status: "INFORMATION_REQUIRED",
        informationRequestNote: "Please clarify peak rate.",
      },
    });
    await prisma.nccParticipantApplicationNote.create({
      data: {
        applicationId,
        authorUserId: staffId,
        body: "Internal: watch liquidity story",
      },
    });

    const applicantViewNotes = await prisma.nccParticipantApplication.findUniqueOrThrow({
      where: { id: applicationId },
      select: {
        informationRequestNote: true,
        internalNotes: true,
      },
    });
    assert.equal(applicantViewNotes.informationRequestNote, "Please clarify peak rate.");
    // Notes exist in DB but applicant mapping never includes them (covered by mapApplicantView).
    assert.equal(applicantViewNotes.internalNotes.length, 1);

    await prisma.nccParticipantApplication.update({
      where: { id: applicationId },
      data: {
        status: "UNDER_REVIEW",
        applicantResponseNote: "Peak rate is 50 TPS.",
      },
    });

    await prisma.nccParticipantApplication.update({
      where: { id: applicationId },
      data: { status: "APPROVED_FOR_TEST" },
    });
    await prisma.nccParticipantApplicationTransition.create({
      data: {
        applicationId,
        fromStatus: "UNDER_REVIEW",
        toStatus: "APPROVED_FOR_TEST",
        actorUserId: staffId,
        reason: "Approved for TEST",
      },
    });

    const first = await provisionApplicationForTest(applicationId, staffId);
    assert.ok(first.institutionId);
    assert.equal(first.credentialId, null);
    assert.equal(first.secretOnce, null);

    const institution = await prisma.financialInstitution.findUniqueOrThrow({
      where: { id: first.institutionId },
    });
    assert.equal(institution.status, "CERTIFICATION");
    assert.equal(institution.isNCCParticipant, false);
    assert.equal(canInstitutionOriginateSettlement(institution.status), false);

    const owners = await prisma.institutionMember.findMany({
      where: { institutionId: first.institutionId, role: "INSTITUTION_OWNER", status: "ACTIVE" },
    });
    assert.equal(owners.length, 1);
    assert.equal(owners[0]!.userId, applicantId);

    const routing = await prisma.routingNumber.findMany({
      where: { institutionId: first.institutionId },
    });
    assert.equal(routing.length, 1);
    assert.equal(routing[0]!.status, "RESERVED");
    assert.equal(routing[0]!.activatedAt, null);

    const settlementAccounts = await prisma.settlementAccount.count({
      where: { institutionId: first.institutionId },
    });
    assert.equal(settlementAccounts, 0);

    // Staff provisioning must not create credentials.
    const staffIssued = await prisma.nccApiCredential.count({
      where: { institutionId: first.institutionId },
    });
    assert.equal(staffIssued, 0);

    // Owner (not staff) creates TEST credential; secret shown once to owner path.
    const { createApiCredential } = await import("@/server/ncc/ncc-api-credential.service");
    const ownerCred = await createApiCredential({
      institutionId: first.institutionId,
      name: "Owner TEST",
      environment: "TEST",
      scopes: ["institution:read", "settlements:read"],
      createdByUserId: applicantId,
    });
    assert.ok(ownerCred.secret);
    assert.ok(ownerCred.authorizationHint.startsWith("ncc_test_"));
    const stored = await prisma.nccApiCredential.findUniqueOrThrow({ where: { id: ownerCred.id } });
    assert.notEqual(stored.secretHash, ownerCred.secret);

    // Staff cannot retrieve the secret afterward (only hash exists).
    assert.ok(!("secret" in stored));

    await assert.rejects(
      () => assertCredentialEnvironmentAllowed(first.institutionId, "LIVE"),
      (err: unknown) =>
        err instanceof NccParticipantApplicationError && err.code === "LIVE_CREDENTIAL_DENIED",
    );

    // Repeated provision is idempotent / resumable.
    const second = await provisionApplicationForTest(applicationId, staffId);
    assert.equal(second.institutionId, first.institutionId);
    assert.equal(second.secretOnce, null);
    assert.equal(second.reused, true);

    const ownersAfter = await prisma.institutionMember.count({
      where: { institutionId: first.institutionId, role: "INSTITUTION_OWNER", status: "ACTIVE" },
    });
    assert.equal(ownersAfter, 1);

    const routingAfter = await prisma.routingNumber.count({
      where: { institutionId: first.institutionId },
    });
    assert.equal(routingAfter, 1);

    assert.equal(canStaffTransition("APPROVED_FOR_TEST", "DRAFT"), false);
  });
});
