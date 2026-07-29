import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BANK_PRIMARY_NAV,
  CORPORATE_PRIMARY_NAV,
  EXCHANGE_PRIMARY_NAV,
  TERMINAL_PRIMARY_NAV,
  filterInternalNavGroupsForAccess,
  filterInternalNavLinksForAccess,
  getInternalContextualNav,
  getInternalNavGroupsForSite,
  getInternalPrimaryNav,
  isInternalNavActive,
  resolveInternalPrimarySection,
  INTERNAL_NAV_GROUPS,
  BANK_INTERNAL_NAV_GROUPS,
  EXCHANGE_INTERNAL_NAV_GROUPS,
  TERMINAL_INTERNAL_NAV_GROUPS,
} from "@/components/internal/console/internal-nav-config";
import type { AltaUser } from "@/lib/auth/types";

function userWithTags(tags: AltaUser["tags"]): AltaUser {
  return {
    id: "u1",
    discordId: "1",
    discordUsername: "tester",
    avatarUrl: null,
    email: null,
    minecraftUsername: null,
    tags,
    accountStatus: "active",
    internalAccess: true,
    companyMemberships: [],
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
}

describe("internal-nav-config", () => {
  it("exposes six primary destinations for corporate, bank, and terminal", () => {
    assert.equal(CORPORATE_PRIMARY_NAV.length, 6);
    assert.equal(BANK_PRIMARY_NAV.length, 6);
    assert.equal(TERMINAL_PRIMARY_NAV.length, 6);
    assert.deepEqual(
      CORPORATE_PRIMARY_NAV.map((l) => l.label),
      ["Home", "Inbox", "Directory", "Money", "Products", "System"],
    );
    assert.deepEqual(
      BANK_PRIMARY_NAV.map((l) => l.label),
      ["Home", "Inbox", "Customers", "Money", "Products", "System"],
    );
    assert.deepEqual(
      TERMINAL_PRIMARY_NAV.map((l) => l.label),
      ["Home", "Inbox", "Investors", "Portfolios", "Orders", "System"],
    );
  });

  it("keeps exchange to Home + Maintenance", () => {
    assert.deepEqual(
      EXCHANGE_PRIMARY_NAV.map((l) => l.to),
      ["/internal", "/internal/exchange/settings"],
    );
  });

  it("returns primary nav via shared helpers used by desktop and mobile", () => {
    assert.equal(getInternalPrimaryNav("corporate"), CORPORATE_PRIMARY_NAV);
    assert.equal(getInternalNavGroupsForSite("corporate"), INTERNAL_NAV_GROUPS);
    assert.equal(getInternalNavGroupsForSite("bank"), BANK_INTERNAL_NAV_GROUPS);
    assert.equal(getInternalNavGroupsForSite("exchange"), EXCHANGE_INTERNAL_NAV_GROUPS);
    assert.equal(getInternalNavGroupsForSite("terminal"), TERMINAL_INTERNAL_NAV_GROUPS);
  });

  it("activates Inbox for legacy queue deep links", () => {
    const inbox = CORPORATE_PRIMARY_NAV.find((l) => l.label === "Inbox")!;
    assert.equal(isInternalNavActive("/internal/inbox", inbox), true);
    assert.equal(isInternalNavActive("/internal/queues/deposits", inbox), true);
    assert.equal(resolveInternalPrimarySection("corporate", "/internal/queues/exceptions"), "inbox");
  });

  it("activates Money for bank money child routes without activating Home", () => {
    assert.equal(resolveInternalPrimarySection("bank", "/internal/bank"), "home");
    assert.equal(resolveInternalPrimarySection("bank", "/internal/bank/accounts"), "money");
    assert.equal(resolveInternalPrimarySection("bank", "/internal/bank/alta-pay"), "money");
    assert.equal(resolveInternalPrimarySection("corporate", "/internal/bank/transactions"), "money");
  });

  it("activates Directory/Customers, Products, and System correctly", () => {
    assert.equal(resolveInternalPrimarySection("corporate", "/internal/users/abc"), "directory");
    assert.equal(resolveInternalPrimarySection("bank", "/internal/companies"), "customers");
    assert.equal(resolveInternalPrimarySection("corporate", "/internal/lending"), "products");
    assert.equal(resolveInternalPrimarySection("corporate", "/internal/alta-card/applications/x"), "products");
    assert.equal(resolveInternalPrimarySection("corporate", "/internal/jobs"), "system");
    assert.equal(resolveInternalPrimarySection("bank", "/internal/bank/settings"), "system");
  });

  it("provides contextual People/Companies/Relationships under Directory and Customers", () => {
    const dir = getInternalContextualNav("corporate", "/internal/users");
    assert.equal(dir?.label, "Directory");
    assert.deepEqual(
      dir?.links.map((l) => l.label),
      ["People", "Companies", "Relationships"],
    );
    const cust = getInternalContextualNav("bank", "/internal/companies");
    assert.equal(cust?.label, "Customers");
    assert.deepEqual(
      cust?.links.map((l) => l.label),
      ["People", "Companies", "Relationships"],
    );
  });

  it("groups Money operations behind an overflow menu", () => {
    const money = getInternalContextualNav("corporate", "/internal/bank/accounts");
    assert.deepEqual(
      money?.links.map((l) => l.label),
      ["Accounts", "Transactions", "Transfers"],
    );
    assert.equal(money?.overflow?.label, "Operations");
    assert.deepEqual(
      money?.overflow?.links.map((l) => l.label),
      ["Alta Pay", "Statements", "Interest"],
    );
  });

  it("scopes Product contextual nav to Overview/Loans or Overview/Cards", () => {
    const lending = getInternalContextualNav("corporate", "/internal/lending");
    assert.equal(lending?.label, "Lending");
    assert.deepEqual(
      lending?.links.map((l) => l.label),
      ["Overview", "Loans"],
    );
    assert.ok(lending?.overflow?.links.some((l) => l.label === "Alta Card"));

    const loans = getInternalContextualNav("bank", "/internal/lending/loans");
    assert.deepEqual(
      loans?.links.map((l) => l.to),
      ["/internal/lending", "/internal/lending/loans"],
    );

    const cards = getInternalContextualNav("corporate", "/internal/alta-card/cards");
    assert.equal(cards?.label, "Alta Card");
    assert.deepEqual(
      cards?.links.map((l) => l.label),
      ["Overview", "Cards"],
    );
    assert.ok(cards?.overflow?.links.some((l) => l.label === "Lending"));
  });

  it("exposes System contextual links without corporate-only items on bank", () => {
    const bankSystem = getInternalContextualNav("bank", "/internal/jobs");
    assert.deepEqual(
      bankSystem?.links.map((l) => l.label),
      ["Jobs", "Audit", "Reports"],
    );
    assert.equal(bankSystem?.overflow?.label, "More");
    assert.ok(bankSystem?.overflow?.links.some((l) => l.label === "Settings"));
    const paths = bankSystem?.links.map((l) => l.to) ?? [];
    assert.equal(paths.includes("/internal/settings"), false);
    assert.equal(paths.includes("/internal/compliance"), false);

    const corpSystem = getInternalContextualNav("corporate", "/internal/embeds");
    assert.deepEqual(
      corpSystem?.links.map((l) => l.label),
      ["Jobs", "Audit", "Reports"],
    );
    assert.equal(corpSystem?.overflow?.label, "More");
    assert.ok(corpSystem?.overflow?.links.some((l) => l.label === "Communications"));
    assert.ok(corpSystem?.overflow?.links.some((l) => l.label === "Risk"));
    assert.ok(corpSystem?.overflow?.links.some((l) => l.label === "Settings"));
    assert.equal(corpSystem?.links.some((l) => l.label === "Compliance"), false);
  });

  it("filters primary destinations by role and site", () => {
    const bankAdmin = userWithTags(["bank_admin"]);
    const filtered = filterInternalNavLinksForAccess(getInternalPrimaryNav("bank"), "bank", bankAdmin);
    const paths = filtered.map((l) => l.to);
    assert.equal(paths.includes("/internal"), false);
    assert.ok(paths.includes("/internal/inbox"));
    assert.ok(paths.includes("/internal/bank"));

    const groups = filterInternalNavGroupsForAccess(INTERNAL_NAV_GROUPS, "bank", bankAdmin);
    const groupPaths = groups.flatMap((g) => g.links.map((l) => l.to));
    assert.equal(groupPaths.includes("/internal"), false);
    assert.ok(groupPaths.includes("/internal/inbox"));
  });
});
