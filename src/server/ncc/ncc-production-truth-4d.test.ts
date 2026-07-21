import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { isDatabaseConfigured, prisma } from "@/server/db";
import { Prisma } from "@prisma/client";
import { asDecimal } from "@/lib/ncc/ncc-money";
import { ExternalParticipantAdapter } from "@/server/ncc/adapters/external-participant.adapter";
import {
  executeCertificationRunAsStaff,
  startCertificationRunAsStaff,
} from "@/server/ncc/ncc-certification.service";
import { upsertInstitutionConnectorAsActor } from "@/server/ncc/ncc-connector.service";
import { provisionApplicationForTest } from "@/server/ncc/ncc-participant-application.service";
import { parseAccountIdentifierFormat } from "@/lib/ncc/ncc-participant-application";
import { setPinnedWebhookTransportForTests } from "@/server/ncc/ncc-webhook-pinned-http";
import { setWebhookDnsResolverForTests } from "@/server/ncc/ncc-webhook-ssrf";
import { ensureAltaInstitutionsSeeded } from "@/server/ncc/ncc-institution.service";
import { submitTerminalFundingRequest } from "@/server/ncc/ncc-funding.service";
import { ensureUserTerminalCashAccount } from "@/server/ncc/terminal-cash.service";
import {
  clearApiSession,
  saveApiSession,
  submitApiApplication,
  validateApiKey,
  readApiSession,
} from "@/lib/exchange/api-access";
import { getCompanies, getIndices, getIPOs, getMarketStats } from "@/lib/exchange/api";
import {
  getHoldings,
  getOrders,
  getPortfolioTransactions,
  getTerminalDashboard,
} from "@/lib/terminal/api";

const RUN = process.env.NCC_SETTLEMENT_TESTS === "1";
const ROOT = join(process.cwd(), "src");

const FORBIDDEN_IMPORT_RE =
  /from\s+["']@\/lib\/mock-data["']|from\s+["']@\/lib\/terminal\/data["']|from\s+["']@\/lib\/bank\/data["']|SHOW_PUBLIC_SIMULATED_MARKET_DATA|SHOW_USER_FINANCIAL_MOCK_DATA|DEMO_API_KEY/;

const SCOPED_ROUTE_DIRS = [
  "routes/ncc",
  "routes/portal",
  "routes/bank/transfers",
  "routes/terminal",
  "routes/exchange",
  "components/site/homepages",
  "components/ncc",
];

function walkTsFiles(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walkTsFiles(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("ncc sprint 4d production truth", () => {
  it("scoped production routes do not import mock-data modules or flags", () => {
    const offenders: string[] = [];
    for (const rel of SCOPED_ROUTE_DIRS) {
      for (const file of walkTsFiles(join(ROOT, rel))) {
        const text = readFileSync(file, "utf8");
        if (FORBIDDEN_IMPORT_RE.test(text)) offenders.push(file.replace(ROOT + "/", ""));
      }
    }
    // Also scan corporate homepage path and bank index
    for (const extra of ["routes/home.tsx", "routes/bank/index.tsx", "lib/config/data-mode.ts"]) {
      const full = join(ROOT, extra);
      try {
        const text = readFileSync(full, "utf8");
        if (extra.endsWith("data-mode.ts")) {
          offenders.push(extra); // file must not exist
        } else if (FORBIDDEN_IMPORT_RE.test(text)) {
          offenders.push(extra);
        }
      } catch {
        // data-mode.ts absence is success
        if (!extra.endsWith("data-mode.ts")) {
          /* optional */
        }
      }
    }
    assert.deepEqual(offenders, []);
  });

  it("public simulated-data flags and DEMO_API_KEY are gone", () => {
    try {
      readFileSync(join(ROOT, "lib/config/data-mode.ts"), "utf8");
      assert.fail("data-mode.ts must not exist");
    } catch (e) {
      assert.ok(e instanceof Error && "code" in e && (e as NodeJS.ErrnoException).code === "ENOENT");
    }
    const apiAccess = readFileSync(join(ROOT, "lib/exchange/api-access.ts"), "utf8");
    assert.equal(apiAccess.includes("DEMO_API_KEY"), false);
    assert.equal(apiAccess.includes("ax_live_"), false);
    assert.equal(apiAccess.includes("generateApiKey"), false);
  });

  it("browser storage cannot issue Exchange credentials", () => {
    assert.equal(validateApiKey("ax_live_anything"), null);
    assert.equal(readApiSession(), null);
    saveApiSession({ key: "ax_live_fake", organization: "Nope" });
    assert.equal(readApiSession(), null);
    const apply = submitApiApplication({
      organization: "Test Org",
      contactName: "Tester",
      useCase: "Other",
      description: "Trying to get a key",
    });
    assert.equal(apply.submitted, false);
    assert.equal(apply.unavailable, true);
    clearApiSession();
  });

  it("empty Terminal accounts do not receive fake holdings or history", () => {
    assert.deepEqual(getHoldings(), []);
    assert.deepEqual(getOrders(), []);
    assert.deepEqual(getPortfolioTransactions(), []);
    const dash = getTerminalDashboard();
    assert.equal(dash.totalNetWorth, 0);
    assert.equal(dash.portfolioValue, 0);
    assert.deepEqual(dash.performanceSeries, []);
  });

  it("empty Exchange renders without fake companies, prices, indices, or IPOs", () => {
    assert.deepEqual(getCompanies(), []);
    assert.deepEqual(getIndices(), []);
    assert.deepEqual(getIPOs(), []);
    const stats = getMarketStats();
    assert.equal(stats.snapshot.status, "Unavailable");
    assert.equal(stats.snapshot.index.value, 0);
    assert.deepEqual(stats.rankings.gainers, []);
    assert.deepEqual(stats.stats, []);
  });

  it("corporate homepage source contains no simulated market metrics", () => {
    const home = readFileSync(
      join(ROOT, "components/site/homepages/corporate-homepage.tsx"),
      "utf8",
    );
    assert.equal(/movers|indexSeries|getIndices|marketCap|NSX-100/.test(home), false);
    assert.equal(home.includes("@/lib/mock-data"), false);
    assert.equal(home.includes("@/lib/exchange/api"), false);
  });
});

describe("ncc sprint 4d connector honesty", {
  skip: !RUN || !isDatabaseConfigured(),
}, () => {
  const suffix = Date.now().toString(36);
  let ownerId = "";
  let staffId = "";
  let institutionId = "";

  before(async () => {
    const owner = await prisma.user.create({
      data: {
        discordId: `ncc-4d-o-${suffix}`,
        discordUsername: `ncc_4d_o_${suffix}`,
      },
    });
    ownerId = owner.id;
    const staff = await prisma.user.create({
      data: {
        discordId: `ncc-4d-s-${suffix}`,
        discordUsername: `ncc_4d_s_${suffix}`,
        tags: { create: [{ tag: "ADMIN" }] },
      },
    });
    staffId = staff.id;

    const app = await prisma.nccParticipantApplication.create({
      data: {
        publicReference: `NCC-APP-4D-${suffix}`,
        status: "APPROVED_FOR_TEST",
        applicantUserId: ownerId,
        legalName: `4D Bank ${suffix}`,
        displayName: `4D Bank ${suffix}`,
        institutionType: "BANK",
        countryJurisdiction: "US",
        registeredAddress: "1 Test St",
        regulatoryAuthority: "Test Authority",
        licenseOrRegistrationNumber: `LIC-4D-${suffix}`,
        primaryContactName: "Owner",
        primaryContactEmail: `owner4d-${suffix}@example.com`,
        complianceContactName: "Compliance",
        complianceContactEmail: `comp4d-${suffix}@example.com`,
        technicalContactName: "Tech",
        technicalContactEmail: `tech4d-${suffix}@example.com`,
        settlementOpsContactName: "Ops",
        settlementOpsContactEmail: `ops4d-${suffix}@example.com`,
        accountIdentifierFormat: parseAccountIdentifierFormat({
          displayLabel: "External id",
          characterFormatDescription: "Alphanumeric",
          exampleMaskedIdentifier: "AB-****-01",
          caseSensitive: true,
          branchCodeRequired: false,
          supportedCurrencies: ["FLR"],
          containsLetters: true,
          containsNumbers: true,
          containsSpaces: false,
          containsPunctuation: true,
        }),
      },
    });
    const provisioned = await provisionApplicationForTest(app.id, staffId);
    institutionId = provisioned.institutionId;
  });

  after(() => {
    setPinnedWebhookTransportForTests(null);
    setWebhookDnsResolverForTests(null);
  });

  it("malformed connector success responses fail; missing connector compensation fails", async () => {
    setWebhookDnsResolverForTests(async () => [{ address: "203.0.113.60", family: 4 }]);
    setPinnedWebhookTransportForTests(async (input) => {
      const path = input.destination.url.pathname;
      if (path.endsWith("/accounts/resolve")) {
        return {
          status: 200,
          body: Buffer.from(
            JSON.stringify({
              status: "RESOLVED",
              participantAccountReference: "ref_4d",
              canDebit: true,
              canCredit: true,
            }),
          ),
          headers: {},
        };
      }
      // Malformed 2xx — missing required references.
      return { status: 200, body: Buffer.from("{}"), headers: {} };
    });

    await upsertInstitutionConnectorAsActor(ownerId, {
      institutionId,
      mode: "API",
      baseUrl: "https://hooks.example/ncc-4d",
      authSecret: "sec_4d",
      certSourceAccountIdentifier: "SRC-4D-01",
      certDestinationAccountIdentifier: "DST-4D-01",
    });
    await prisma.nccParticipantConnector.update({
      where: { institutionId },
      data: { certificationStatus: "PASSED", status: "ACTIVE" },
    });

    const adapter = new ExternalParticipantAdapter(institutionId);
    const prep = await adapter.prepareDebit({
      settlementInstructionId: `si-malformed-${suffix}`,
      publicReference: `NCC-4D-M-${suffix}`,
      amount: "1.00",
      currency: "FLR",
      accountReference: "ref_4d",
    });
    assert.equal(prep.ok, false);
    if (!prep.ok) assert.equal(prep.code, "MALFORMED_CONNECTOR_RESPONSE");

    // Directory-only / missing money connector must not no-op compensate.
    await upsertInstitutionConnectorAsActor(ownerId, {
      institutionId,
      mode: "DIRECTORY",
    });
    const adapterDir = new ExternalParticipantAdapter(institutionId);
    const comp = await adapterDir.compensateDebit({
      settlementInstructionId: `si-comp-${suffix}`,
      publicReference: `NCC-4D-C-${suffix}`,
      amount: "1.00",
      currency: "FLR",
      accountReference: "ref_4d",
    });
    assert.equal(comp.ok, false);
    if (!comp.ok) assert.equal(comp.code, "SOURCE_ADAPTER_UNAVAILABLE");
  });

  it("ambiguous destination credit uses operation-status recovery", async () => {
    setWebhookDnsResolverForTests(async () => [{ address: "203.0.113.60", family: 4 }]);
    let creditCalls = 0;
    setPinnedWebhookTransportForTests(async (input) => {
      const path = input.destination.url.pathname;
      if (path.endsWith("/credits")) {
        creditCalls += 1;
        if (creditCalls === 1) throw new Error("TIMEOUT waiting for connector");
        return {
          status: 200,
          body: Buffer.from(
            JSON.stringify({ status: "CREDITED", externalReference: "ext_credit_rec" }),
          ),
          headers: {},
        };
      }
      if (path.endsWith("/operations/status")) {
        return {
          status: 200,
          body: Buffer.from(
            JSON.stringify({ status: "CREDITED", externalReference: "ext_credit_rec" }),
          ),
          headers: {},
        };
      }
      return { status: 200, body: Buffer.from("{}"), headers: {} };
    });

    await upsertInstitutionConnectorAsActor(ownerId, {
      institutionId,
      mode: "API",
      baseUrl: "https://hooks.example/ncc-4d-credit",
      authSecret: "sec_4d_credit",
    });
    await prisma.nccParticipantConnector.update({
      where: { institutionId },
      data: { certificationStatus: "PASSED", status: "ACTIVE" },
    });

    const adapter = new ExternalParticipantAdapter(institutionId);
    const credit = await adapter.notifyCredit({
      settlementInstructionId: `si-credit-amb-${suffix}`,
      publicReference: `NCC-4D-CA-${suffix}`,
      amount: "2.00",
      currency: "FLR",
      accountReference: "ref_dest",
    });
    assert.equal(credit.ok, true);
    if (credit.ok) assert.equal(credit.externalReference, "ext_credit_rec");
  });

  it("certification cannot pass unexecuted checks", async () => {
    await upsertInstitutionConnectorAsActor(ownerId, {
      institutionId,
      mode: "DIRECTORY",
    });
    const run = await startCertificationRunAsStaff(institutionId, staffId);
    const finished = await executeCertificationRunAsStaff(run.id, staffId);
    assert.equal(finished.status, "FAILED");
    const autoPassedForbidden = [
      "webhook_signature_verification",
      "webhook_retry_handling",
      "reconciliation_response",
      "timeout_behavior",
      "unsupported_identifier",
    ];
    for (const key of autoPassedForbidden) {
      const check = finished.checks.find((c) => c.checkKey === key);
      assert.ok(check);
      assert.notEqual(check!.status, "PASS", key);
    }
  });

  it("NCC settlement and account resolution contain no runtime fixture fallback", async () => {
    const resolution = readFileSync(
      join(ROOT, "server/ncc/ncc-account-resolution.service.ts"),
      "utf8",
    );
    const settlement = readFileSync(join(ROOT, "server/ncc/ncc-settlement.service.ts"), "utf8");
    assert.equal(/mock|fixture|sampleSettlement|fakeAccount/i.test(resolution), false);
    assert.equal(/SHOW_.*MOCK|runtimeFixture|demoSettlement/i.test(settlement), false);
  });

  it("existing Bank → Terminal instant settlement still works", async () => {
    await ensureAltaInstitutionsSeeded();
    const user = await prisma.user.create({
      data: {
        discordId: `ncc-4d-term-${suffix}`,
        discordUsername: `ncc_4d_term_${suffix}`,
      },
    });
    const bank = await prisma.bankAccount.create({
      data: {
        userId: user.id,
        accountType: "CHECKING",
        accountName: `NCC 4D ${suffix}`,
        accountNumber: `AB-2000-${String(100000 + ((Number.parseInt(suffix.slice(-5), 36) + 55) % 900000)).padStart(6, "0")}`,
        status: "ACTIVE",
        balance: new Prisma.Decimal(500),
        currency: "FLR",
        ownershipType: "PERSONAL",
      },
    });
    const cash = await ensureUserTerminalCashAccount(user.id, "FLR");
    const before = asDecimal(cash.availableBalance);
    const result = await submitTerminalFundingRequest(user.id, {
      sourceBankAccountId: bank.id,
      amount: 15,
      idempotencyKey: `4d-alta-fund-${suffix}`,
    });
    assert.equal(result.status, "COMPLETED");
    const after = await prisma.terminalCashAccount.findUniqueOrThrow({ where: { id: cash.id } });
    assert.equal(Number(asDecimal(after.availableBalance).sub(before)), 15);
  });
});
