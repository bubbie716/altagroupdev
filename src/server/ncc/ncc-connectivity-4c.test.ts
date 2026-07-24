import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { isDatabaseConfigured, prisma } from "@/server/db";
import { encryptSecret } from "@/server/crypto";
import {
  parseDirectoryCsv,
  validateDirectoryRows,
} from "@/lib/ncc/ncc-directory";
import { createApiCredential } from "@/server/ncc/ncc-api-credential.service";
import { ExternalParticipantAdapter } from "@/server/ncc/adapters/external-participant.adapter";
import { getAdapterForInstitution } from "@/server/ncc/institution-adapter.registry";
import {
  executeCertificationRunAsStaff,
  markCertificationPassedForTests,
  startCertificationRunAsStaff,
} from "@/server/ncc/ncc-certification.service";
import { upsertInstitutionConnectorAsActor } from "@/server/ncc/ncc-connector.service";
import {
  activateDirectoryVersionAsActor,
  resolveFromActiveDirectory,
  rollbackDirectoryVersionAsActor,
  uploadDirectoryCsvAsActor,
} from "@/server/ncc/ncc-directory.service";
import { callExternalConnector } from "@/server/ncc/ncc-external-connector-client";
import {
  evaluateLivePromotionGates,
  NccLivePromotionError,
  promoteInstitutionToLiveAsStaff,
} from "@/server/ncc/ncc-live-promotion.service";
import {
  assertCredentialEnvironmentAllowed,
  NccParticipantApplicationError,
  provisionApplicationForTest,
} from "@/server/ncc/ncc-participant-application.service";
import {
  DEFAULT_REQUIRED_DOCUMENTS,
  parseAccountIdentifierFormat,
} from "@/lib/ncc/ncc-participant-application";
import { setPinnedWebhookTransportForTests } from "@/server/ncc/ncc-webhook-pinned-http";
import { setWebhookDnsResolverForTests } from "@/server/ncc/ncc-webhook-ssrf";
import { asDecimal } from "@/lib/ncc/ncc-money";
import { ensureAltaInstitutionsSeeded } from "@/server/ncc/ncc-institution.service";
import { submitTerminalFundingRequest } from "@/server/ncc/ncc-funding.service";
import { ensureUserTerminalCashAccount } from "@/server/ncc/terminal-cash.service";
import { ALTA_BANK_INSTITUTION_ID } from "@/lib/bank/account-ownership";
import { Prisma } from "@prisma/client";

const RUN = process.env.NCC_SETTLEMENT_TESTS === "1";

function formatProfile() {
  return parseAccountIdentifierFormat({
    displayLabel: "External id",
    characterFormatDescription: "Alphanumeric",
    exampleMaskedIdentifier: "AB-****-17-X",
    caseSensitive: true,
    branchCodeRequired: false,
    supportedCurrencies: ["FLR"],
    containsLetters: true,
    containsNumbers: true,
    containsSpaces: false,
    containsPunctuation: true,
    examples: ["AB-4928-17-X", "0001847291"],
  });
}

/** Sprint 4E LIVE gate: accepted unexpired mandatory regulatory documents. */
async function acceptMandatoryDocumentsForLive(
  applicationId: string,
  uploaderUserId: string,
  reviewerUserId: string,
) {
  const app = await prisma.nccParticipantApplication.findUniqueOrThrow({
    where: { id: applicationId },
    select: { requiredDocuments: true },
  });
  const required = Array.isArray(app.requiredDocuments)
    ? (app.requiredDocuments as string[])
    : [...DEFAULT_REQUIRED_DOCUMENTS];
  for (const documentType of required) {
    await prisma.nccParticipantDocument.create({
      data: {
        applicationId,
        documentType,
        status: "ACCEPTED",
        storageKey: `ncc-participant-docs/${applicationId}/${documentType.replace(/\W+/g, "_")}.pdf`,
        originalFileName: `${documentType}.pdf`,
        contentType: "application/pdf",
        byteSize: 32,
        sha256: `sha-${documentType.slice(0, 12)}`,
        uploadedByUserId: uploaderUserId,
        reviewedByUserId: reviewerUserId,
        reviewedAt: new Date(),
        reviewNote: "Safe manual review completed for certification tests",
      },
    });
  }
}

describe("ncc sprint 4c connectivity certification", {
  skip: !RUN || !isDatabaseConfigured(),
}, () => {
  const suffix = Date.now().toString(36);
  let ownerId = "";
  let staffId = "";
  let institutionId = "";
  let applicationId = "";

  before(async () => {
    const owner = await prisma.user.create({
      data: {
        discordId: `ncc-4c-o-${suffix}`,
        discordUsername: `ncc_4c_o_${suffix}`,
      },
    });
    ownerId = owner.id;
    const staff = await prisma.user.create({
      data: {
        discordId: `ncc-4c-s-${suffix}`,
        discordUsername: `ncc_4c_s_${suffix}`,
        tags: { create: [{ tag: "CORPORATE_ADMIN" }] },
      },
    });
    staffId = staff.id;

    const app = await prisma.nccParticipantApplication.create({
      data: {
        publicReference: `NCC-APP-4C-${suffix}`,
        status: "APPROVED_FOR_TEST",
        applicantUserId: ownerId,
        legalName: `4C Bank ${suffix}`,
        displayName: `4C Bank ${suffix}`,
        institutionType: "BANK",
        countryJurisdiction: "US",
        registeredAddress: "1 Test St",
        regulatoryAuthority: "Test Authority",
        licenseOrRegistrationNumber: `LIC-${suffix}`,
        primaryContactName: "Owner",
        primaryContactEmail: `owner-${suffix}@example.com`,
        complianceContactName: "Compliance",
        complianceContactEmail: `comp-${suffix}@example.com`,
        technicalContactName: "Tech",
        technicalContactEmail: `tech-${suffix}@example.com`,
        settlementOpsContactName: "Ops",
        settlementOpsContactEmail: `ops-${suffix}@example.com`,
        accountIdentifierFormat: formatProfile(),
      },
    });
    applicationId = app.id;
    const provisioned = await provisionApplicationForTest(applicationId, staffId);
    institutionId = provisioned.institutionId;
    assert.equal(provisioned.secretOnce, null);
  });

  after(() => {
    setPinnedWebhookTransportForTests(null);
    setWebhookDnsResolverForTests(null);
  });

  it("owner receives TEST credential directly; staff cannot retrieve secret afterward", async () => {
    const cred = await createApiCredential({
      institutionId,
      name: "Owner TEST 4C",
      environment: "TEST",
      scopes: ["institution:read", "settlements:read"],
      createdByUserId: ownerId,
    });
    assert.ok(cred.secret);
    assert.ok(cred.authorizationHint.startsWith("ncc_test_"));
    const stored = await prisma.nccApiCredential.findUniqueOrThrow({ where: { id: cred.id } });
    assert.notEqual(stored.secretHash, cred.secret);
    assert.ok(!("secret" in stored));
    await assert.rejects(
      () => assertCredentialEnvironmentAllowed(institutionId, "LIVE"),
      (e: unknown) =>
        e instanceof NccParticipantApplicationError && e.code === "LIVE_CREDENTIAL_DENIED",
    );
  });

  it("validates spreadsheet rows, rejects forbidden columns and duplicates", () => {
    const csv = [
      "accountIdentifier,participantAccountReference,currency,status,canDebit,canCredit,beneficiaryLabel",
      "0001847291,ref_a,FLR,ACTIVE,true,true,Alice",
      "BR05/839201,ref_b,FLR,ACTIVE,true,false,",
      "0001847291,ref_dup,FLR,ACTIVE,true,true,",
      "bad,ref_c,USD,ACTIVE,true,true,",
    ].join("\n");
    const { headers, rows } = parseDirectoryCsv(csv);
    const result = validateDirectoryRows(headers, rows, "FLR");
    assert.equal(result.counts.valid, 2);
    assert.equal(result.counts.duplicates, 1);
    assert.ok(result.validRows.some((r) => r.accountIdentifier === "0001847291"));
    assert.ok(result.validRows.some((r) => r.accountIdentifier === "BR05/839201"));

    const forbidden = parseDirectoryCsv(
      "accountIdentifier,participantAccountReference,currency,status,canDebit,canCredit,balance\nx,y,FLR,ACTIVE,true,true,1\n",
    );
    const rejected = validateDirectoryRows(forbidden.headers, forbidden.rows, "FLR");
    assert.equal(rejected.counts.valid, 0);
    assert.ok(rejected.rejected[0]?.reason.includes("Forbidden"));
  });

  it("directory mode preserves leading zeros/punctuation; activation and rollback are atomic", async () => {
    await upsertInstitutionConnectorAsActor(ownerId, {
      institutionId,
      mode: "DIRECTORY",
    });

    const upload1 = await uploadDirectoryCsvAsActor(ownerId, {
      institutionId,
      fileName: "v1.csv",
      csvText: [
        "accountIdentifier,participantAccountReference,currency,status,canDebit,canCredit",
        "0001847291,ref_zero_1,FLR,ACTIVE,true,true",
        "BR05/839201,ref_punct_1,FLR,ACTIVE,true,true",
      ].join("\n"),
    });
    assert.equal(upload1.diff.added, 2);
    assert.equal(upload1.validation.validRows.length, 0); // never return raw refs publicly
    assert.equal(upload1.version.status, "VALIDATED");

    const active1 = await activateDirectoryVersionAsActor(ownerId, {
      institutionId,
      versionId: upload1.version.id,
    });
    assert.equal(active1.status, "ACTIVE");

    const zero = await resolveFromActiveDirectory({
      institutionId,
      accountIdentifier: "0001847291",
      currency: "FLR",
      direction: "credit",
    });
    assert.equal(zero.ok, true);
    if (zero.ok) {
      assert.equal(zero.canonicalIdentifier, "0001847291");
      assert.equal(zero.participantAccountReference, "ref_zero_1");
      assert.ok(zero.maskedIdentifier.includes("*"));
    }

    const punct = await resolveFromActiveDirectory({
      institutionId,
      accountIdentifier: "BR05/839201",
      currency: "FLR",
      direction: "debit",
    });
    assert.equal(punct.ok, true);

    const upload2 = await uploadDirectoryCsvAsActor(ownerId, {
      institutionId,
      fileName: "v2.csv",
      csvText: [
        "accountIdentifier,participantAccountReference,currency,status,canDebit,canCredit",
        "0001847291,ref_zero_2,FLR,ACTIVE,true,true",
        "BR05/839201,ref_punct_1,FLR,CLOSED,false,false",
      ].join("\n"),
    });
    await activateDirectoryVersionAsActor(ownerId, {
      institutionId,
      versionId: upload2.version.id,
    });

    const actives = await prisma.nccAccountDirectoryVersion.count({
      where: { institutionId, currency: "FLR", status: "ACTIVE" },
    });
    assert.equal(actives, 1);

    const rolled = await rollbackDirectoryVersionAsActor(ownerId, { institutionId });
    assert.ok(rolled);
    assert.equal(rolled!.versionNumber, upload1.version.versionNumber);
    assert.equal(rolled!.status, "ACTIVE");

    const afterRollback = await resolveFromActiveDirectory({
      institutionId,
      accountIdentifier: "0001847291",
      currency: "FLR",
      direction: "credit",
    });
    assert.equal(afterRollback.ok, true);
    if (afterRollback.ok) {
      assert.equal(afterRollback.participantAccountReference, "ref_zero_1");
    }

    // Same identifier at a second bank remains independent.
    const other = await prisma.financialInstitution.create({
      data: {
        legalName: `Other 4C ${suffix}`,
        displayName: `Other 4C ${suffix}`,
        slug: `other-4c-${suffix}`,
        institutionType: "BANK",
        status: "CERTIFICATION",
        isAlta: false,
        isNCCParticipant: false,
      },
    });
    const otherUpload = await uploadDirectoryCsvAsActor(ownerId, {
      institutionId: other.id,
      csvText: [
        "accountIdentifier,participantAccountReference,currency,status,canDebit,canCredit",
        "0001847291,ref_other_bank,FLR,ACTIVE,true,true",
      ].join("\n"),
    });
    await activateDirectoryVersionAsActor(ownerId, {
      institutionId: other.id,
      versionId: otherUpload.version.id,
    });
    const a = await resolveFromActiveDirectory({
      institutionId,
      accountIdentifier: "0001847291",
      currency: "FLR",
      direction: "credit",
    });
    const b = await resolveFromActiveDirectory({
      institutionId: other.id,
      accountIdentifier: "0001847291",
      currency: "FLR",
      direction: "credit",
    });
    assert.ok(a.ok && b.ok);
    if (a.ok && b.ok) {
      assert.notEqual(a.participantAccountReference, b.participantAccountReference);
    }
  });

  it("directory-only institution cannot pass money-movement certification", async () => {
    await upsertInstitutionConnectorAsActor(ownerId, {
      institutionId,
      mode: "DIRECTORY",
    });
    const run = await startCertificationRunAsStaff(institutionId, staffId);
    const finished = await executeCertificationRunAsStaff(run.id, staffId);
    assert.equal(finished.status, "FAILED");
    const money = finished.checks.find((c) => c.checkKey === "money_movement_requires_api");
    assert.equal(money?.status, "FAIL");
    const gates = await evaluateLivePromotionGates(institutionId);
    assert.equal(gates.ok, false);
    assert.ok(gates.blockers.includes("CONNECTOR_NOT_CERTIFIED"));
  });

  it("connector auth + SSRF rejection; API resolve alphanumeric; debit/credit idempotency and timeout recovery", async () => {
    setWebhookDnsResolverForTests(async () => [{ address: "203.0.113.50", family: 4 }]);
    const seen = new Map<string, number>();
    setPinnedWebhookTransportForTests(async (input) => {
      const path = input.destination.url.pathname;
      const body = JSON.parse(input.body) as Record<string, unknown>;
      const key = String(body.idempotencyKey ?? path);
      seen.set(key, (seen.get(key) ?? 0) + 1);

      if (path.endsWith("/accounts/resolve")) {
        return {
          status: 200,
          body: Buffer.from(
            JSON.stringify({
              status: "RESOLVED",
              participantAccountReference: "ref_api_739af21",
              canonicalIdentifier: body.accountIdentifier,
              maskedIdentifier: "AB-****-17-X",
              canDebit: true,
              canCredit: true,
            }),
          ),
          headers: {},
        };
      }
      if (path.endsWith("/debits/prepare")) {
        return {
          status: 200,
          body: Buffer.from(JSON.stringify({ holdReference: "hold_1" })),
          headers: {},
        };
      }
      if (path.endsWith("/debits/commit")) {
        if ((seen.get(key) ?? 0) === 1) {
          throw new Error("TIMEOUT waiting for connector");
        }
        return {
          status: 200,
          body: Buffer.from(JSON.stringify({ externalReference: "ext_commit_1", status: "COMMITTED" })),
          headers: {},
        };
      }
      if (path.endsWith("/operations/status")) {
        return {
          status: 200,
          body: Buffer.from(JSON.stringify({ status: "COMMITTED", externalReference: "ext_commit_1" })),
          headers: {},
        };
      }
      if (path.endsWith("/credits")) {
        return {
          status: 200,
          body: Buffer.from(JSON.stringify({ externalReference: "ext_credit_1" })),
          headers: {},
        };
      }
      if (path.endsWith("/debits/compensate") || path.endsWith("/debits/release")) {
        return {
          status: 200,
          body: Buffer.from(JSON.stringify({ externalReference: "ext_ok" })),
          headers: {},
        };
      }
      return { status: 200, body: Buffer.from("{}"), headers: {} };
    });

    await assert.rejects(
      () =>
        upsertInstitutionConnectorAsActor(ownerId, {
          institutionId,
          mode: "API",
          baseUrl: "https://127.0.0.1/connector",
          authSecret: "sec_test",
        }),
      /rejected|URL|private|loopback|CONNECTOR|WEBHOOK/i,
    );

    const connector = await upsertInstitutionConnectorAsActor(ownerId, {
      institutionId,
      mode: "API",
      baseUrl: "https://hooks.example/ncc-connector",
      authSecret: "sec_test_4c",
      timeoutMs: 5000,
    });
    assert.equal(connector.hasAuthSecret, true);
    assert.equal("authSecretEncrypted" in connector, false);

    await prisma.nccParticipantConnector.update({
      where: { institutionId },
      data: { certificationStatus: "PASSED", status: "ACTIVE" },
    });

    const adapter = new ExternalParticipantAdapter(institutionId);
    const resolved = await adapter.resolveAccount({
      accountNumber: "AB-4928-17-X",
      currency: "FLR",
      direction: "credit",
    });
    assert.equal(resolved.ok, true);
    if (resolved.ok) {
      assert.equal(resolved.account.internalAccountReference, "ref_api_739af21");
      assert.equal(resolved.account.canonicalAccountNumber, "AB-4928-17-X");
    }

    const prep = await adapter.prepareDebit({
      settlementInstructionId: `si-prep-${suffix}`,
      publicReference: `NCC-4C-${suffix}`,
      amount: "10.00",
      currency: "FLR",
      accountReference: "ref_api_739af21",
    });
    assert.equal(prep.ok, true);

    const commit = await adapter.commitDebit({
      settlementInstructionId: `si-commit-${suffix}`,
      publicReference: `NCC-4C-${suffix}`,
      amount: "10.00",
      currency: "FLR",
      accountReference: "ref_api_739af21",
      holdReference: prep.ok ? prep.holdReference : "hold_1",
    });
    assert.equal(commit.ok, true);
    if (commit.ok) assert.equal(commit.externalReference, "ext_commit_1");

    const credit1 = await adapter.notifyCredit({
      settlementInstructionId: `si-credit-${suffix}`,
      publicReference: `NCC-4C-C-${suffix}`,
      amount: "10.00",
      currency: "FLR",
      accountReference: "ref_api_739af21",
    });
    const credit2 = await adapter.notifyCredit({
      settlementInstructionId: `si-credit-${suffix}`,
      publicReference: `NCC-4C-C-${suffix}`,
      amount: "10.00",
      currency: "FLR",
      accountReference: "ref_api_739af21",
    });
    assert.equal(credit1.ok, true);
    assert.equal(credit2.ok, true);

    const missingSecret = await callExternalConnector({
      baseUrl: "https://hooks.example/ncc-connector",
      authSecretEncrypted: null,
      timeoutMs: 2000,
      op: "queryStatus",
      body: { requestId: "x", idempotencyKey: "x" },
    });
    assert.equal(missingSecret.ok, false);
    if (!missingSecret.ok) assert.equal(missingSecret.code, "CONNECTOR_AUTH_MISSING");
  });

  it("failed certification blocks LIVE; successful certification allows activation at 0.00", async () => {
    setWebhookDnsResolverForTests(async () => [{ address: "203.0.113.50", family: 4 }]);
    setPinnedWebhookTransportForTests(async (input) => {
      const path = input.destination.url.pathname;
      if (path.endsWith("/accounts/resolve")) {
        return {
          status: 200,
          body: Buffer.from(
            JSON.stringify({
              status: "RESOLVED",
              participantAccountReference: "ref_cert",
              canDebit: true,
              canCredit: true,
            }),
          ),
          headers: {},
        };
      }
      return {
        status: 200,
        body: Buffer.from(JSON.stringify({ holdReference: "h", externalReference: "e", status: "COMMITTED" })),
        headers: {},
      };
    });

    await upsertInstitutionConnectorAsActor(ownerId, {
      institutionId,
      mode: "API",
      baseUrl: "https://hooks.example/ncc-connector",
      authSecret: "sec_live_4c",
    });

    await prisma.nccParticipantApplication.update({
      where: { id: applicationId },
      data: { status: "APPROVED_FOR_LIVE" },
    });

    // Not certified yet → blocked
    await assert.rejects(
      () => promoteInstitutionToLiveAsStaff(institutionId, staffId),
      (e: unknown) => e instanceof NccLivePromotionError,
    );

    await markCertificationPassedForTests(institutionId, staffId);
    await acceptMandatoryDocumentsForLive(applicationId, ownerId, staffId);
    const gates = await evaluateLivePromotionGates(institutionId);
    assert.equal(gates.ok, true);

    const promoted = await promoteInstitutionToLiveAsStaff(institutionId, staffId);
    assert.ok(promoted.routingNumber);
    assert.equal(Number(promoted.ledgerBalance), 0);

    const institution = await prisma.financialInstitution.findUniqueOrThrow({
      where: { id: institutionId },
    });
    assert.equal(institution.status, "ACTIVE");
    assert.equal(institution.isNCCParticipant, true);

    const routing = await prisma.routingNumber.findFirstOrThrow({
      where: { institutionId, isPrimary: true },
    });
    assert.equal(routing.status, "ACTIVE");
    assert.ok(routing.activatedAt);

    const settlement = await prisma.settlementAccount.findFirstOrThrow({
      where: { institutionId, currency: "FLR" },
    });
    assert.equal(Number(settlement.ledgerBalance), 0);
    assert.equal(Number(settlement.availableBalance), 0);
    assert.notEqual(Number(settlement.ledgerBalance), 1_000_000_000);

    // Only owner path after LIVE — LIVE credential allowed for ACTIVE participant.
    await assertCredentialEnvironmentAllowed(institutionId, "LIVE");
    const liveCred = await createApiCredential({
      institutionId,
      name: "Owner LIVE",
      environment: "LIVE",
      scopes: ["institution:read", "settlements:create"],
      createdByUserId: ownerId,
    });
    assert.ok(liveCred.secret.startsWith("ncc_live_") || liveCred.authorizationHint.startsWith("ncc_live_"));
    const storedLive = await prisma.nccApiCredential.findUniqueOrThrow({ where: { id: liveCred.id } });
    assert.notEqual(storedLive.secretHash, liveCred.secret);

    // Re-promotion is idempotent — returns the already completed activation.
    const again = await promoteInstitutionToLiveAsStaff(institutionId, staffId);
    assert.equal(again.reused, true);
    assert.equal(again.institutionId, institutionId);
    assert.equal(again.routingNumber, promoted.routingNumber);
  });

  it("registry returns ExternalParticipantAdapter for non-Alta institutions with a connector", async () => {
    const adapter = await getAdapterForInstitution({
      id: institutionId,
      slug: `ext-${suffix}`,
      isAlta: false,
    });
    assert.ok(adapter instanceof ExternalParticipantAdapter);
  });

  it("existing Alta Bank ↔ Terminal settlement still passes instantly", async () => {
    await ensureAltaInstitutionsSeeded();
    const user = await prisma.user.create({
      data: {
        discordId: `ncc-4c-term-${suffix}`,
        discordUsername: `ncc_4c_term_${suffix}`,
      },
    });
    const bank = await prisma.bankAccount.create({
      data: {
        userId: user.id,
        accountType: "CHECKING",
        accountName: `NCC 4C ${suffix}`,
        accountNumber: `AB-2000-${String(100000 + ((Number.parseInt(suffix.slice(-5), 36) + 40) % 900000)).padStart(6, "0")}`,
        status: "ACTIVE",
        balance: new Prisma.Decimal(500),
        currency: "FLR",
        ownershipType: "PERSONAL",
      },
    });
    const cash = await ensureUserTerminalCashAccount(user.id, "FLR");
    const beforeCash = asDecimal(cash.availableBalance);

    const result = await submitTerminalFundingRequest(user.id, {
      sourceBankAccountId: bank.id,
      amount: 25,
      idempotencyKey: `4c-alta-fund-${suffix}`,
    });
    assert.equal(result.status, "COMPLETED");
    assert.ok(result.settlementInstructionId);

    const instruction = await prisma.settlementInstruction.findUniqueOrThrow({
      where: { id: result.settlementInstructionId! },
    });
    assert.equal(instruction.status, "SETTLED");

    const afterCash = await prisma.terminalCashAccount.findUniqueOrThrow({ where: { id: cash.id } });
    assert.equal(Number(asDecimal(afterCash.availableBalance).sub(beforeCash)), 25);
  });

  it("participant references never appear on connector public view", async () => {
    const secret = await encryptSecret("hidden");
    void secret;
    const view = await upsertInstitutionConnectorAsActor(ownerId, {
      institutionId,
      mode: "DIRECTORY",
    });
    const json = JSON.stringify(view);
    assert.equal(json.includes("ref_zero_1"), false);
    assert.equal(json.includes("participantAccountReference"), false);
    assert.equal(json.includes("authSecretEncrypted"), false);
  });
});
