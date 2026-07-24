import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getDiscordCommunitiesForSite,
  getLegalDocCategoriesForSite,
  getLegalDocsForSite,
} from "@/lib/site/site-scoped-content";

describe("site-scoped-content", () => {
  it("shows all legal docs on corporate site", () => {
    const docs = getLegalDocsForSite("corporate");
    assert.ok(docs.some((doc) => doc.id.startsWith("AG-")));
    assert.ok(docs.some((doc) => doc.id.startsWith("AB-")));
    assert.ok(docs.some((doc) => doc.id.startsWith("AT-")));
    assert.equal(docs.some((doc) => doc.id.startsWith("AE-")), false);
  });

  it("shows Alta Group and bank docs on bank site", () => {
    const docs = getLegalDocsForSite("bank");
    assert.ok(docs.some((doc) => doc.id.startsWith("AG-")));
    assert.ok(docs.some((doc) => doc.id.startsWith("AB-")));
    assert.equal(docs.some((doc) => doc.id.startsWith("AE-")), false);
    assert.equal(docs.some((doc) => doc.id.startsWith("AT-")), false);
    for (const id of ["AB-LEGAL-008", "AB-LEGAL-009"]) {
      assert.ok(docs.some((doc) => doc.id === id), `missing ${id}`);
    }
  });

  it("shows Alta Group docs on legacy host and the complete Terminal document suite", () => {
    const exchangeDocs = getLegalDocsForSite("exchange");
    assert.ok(exchangeDocs.some((doc) => doc.id.startsWith("AG-")));
    assert.equal(exchangeDocs.some((doc) => doc.id.startsWith("AE-")), false);

    const terminalDocs = getLegalDocsForSite("terminal");
    assert.ok(terminalDocs.some((doc) => doc.id.startsWith("AG-")));
    assert.ok(terminalDocs.some((doc) => doc.id === "AT-COR-001"));
    assert.deepEqual(
      terminalDocs.filter((doc) => doc.id.startsWith("AT-LEGAL-")).map((doc) => doc.id),
      ["AT-LEGAL-001", "AT-LEGAL-002", "AT-LEGAL-003", "AT-LEGAL-004", "AT-LEGAL-005"],
    );
    assert.equal(terminalDocs.some((doc) => doc.id.startsWith("AE-")), false);
    assert.equal(terminalDocs.some((doc) => doc.id.startsWith("AB-")), false);
  });

  it("shows all discord communities on corporate support", () => {
    const communities = getDiscordCommunitiesForSite("corporate");
    assert.deepEqual(
      communities.map((c) => c.entity),
      ["group", "bank", "markets"],
    );
  });

  it("shows Alta Group and sub discord on entity sites", () => {
    assert.deepEqual(
      getDiscordCommunitiesForSite("bank").map((c) => c.entity),
      ["group", "bank"],
    );
    assert.deepEqual(
      getDiscordCommunitiesForSite("exchange").map((c) => c.entity),
      ["group", "markets"],
    );
    assert.deepEqual(
      getDiscordCommunitiesForSite("terminal").map((c) => c.entity),
      ["group", "markets"],
    );
  });
});
