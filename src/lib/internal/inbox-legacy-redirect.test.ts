import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LEGACY_QUEUE_TO_INBOX, parseInboxSearch } from "@/lib/internal/inbox-types";

/** Mirror of queue route beforeLoad redirect search construction. */
function legacyQueueRedirectSearch(slug: keyof typeof LEGACY_QUEUE_TO_INBOX) {
  const mapped = LEGACY_QUEUE_TO_INBOX[slug]!;
  return parseInboxSearch({
    category: mapped.category,
    type: mapped.type,
  });
}

describe("legacy queue → Inbox redirects", () => {
  it("maps every legacy queue slug to a stable Inbox filter", () => {
    const expected: Record<string, { category?: string; type?: string }> = {
      deposits: { category: "money", type: "deposit" },
      withdrawals: { category: "money", type: "withdrawal" },
      "account-openings": { category: "account_opening", type: "account_opening" },
      "company-verifications": { category: "companies", type: "company_verification" },
      "lending-applications": { category: "lending", type: "lending_application" },
      "alta-card-applications": { category: "cards", type: "alta_card_application" },
      "alta-card-reviews": { category: "cards", type: "alta_card_review" },
      "deal-rooms": { type: "deal_room" },
      exceptions: { category: "risk", type: "exception" },
    };

    for (const [slug, mapping] of Object.entries(expected)) {
      assert.deepEqual(LEGACY_QUEUE_TO_INBOX[slug], mapping);
      const search = legacyQueueRedirectSearch(slug as keyof typeof LEGACY_QUEUE_TO_INBOX);
      if (mapping.category) assert.equal(search.category, mapping.category);
      if (mapping.type) assert.equal(search.type, mapping.type);
    }
  });

  it("defaults missing category to all without inventing types", () => {
    const dealRooms = legacyQueueRedirectSearch("deal-rooms");
    assert.equal(dealRooms.category, "all");
    assert.equal(dealRooms.type, "deal_room");
  });
});
