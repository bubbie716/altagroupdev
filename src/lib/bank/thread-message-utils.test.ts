import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isOwnThreadMessage } from "@/lib/bank/thread-message-utils";
import type { LoanApplicationThreadMessageRow } from "@/lib/bank/loan-application-thread-types";

function message(
  partial: Partial<LoanApplicationThreadMessageRow>,
): LoanApplicationThreadMessageRow {
  return {
    id: "msg-1",
    senderUserId: null,
    senderRole: "applicant",
    senderName: "trappman1",
    senderAvatarUrl: null,
    body: "hi",
    attachments: [],
    source: "discord",
    createdAt: new Date().toISOString(),
    createdAtLabel: "6:11 PM",
    ...partial,
  };
}

describe("isOwnThreadMessage", () => {
  it("shows only the viewing staff member's messages as own on internal threads", () => {
    const staffA = "staff-a";
    const staffB = "staff-b";

    assert.equal(
      isOwnThreadMessage(
        message({ senderRole: "alta_staff", senderUserId: staffA }),
        "internal",
        staffA,
      ),
      true,
    );
    assert.equal(
      isOwnThreadMessage(
        message({ senderRole: "alta_staff", senderUserId: staffB }),
        "internal",
        staffA,
      ),
      false,
    );
    assert.equal(
      isOwnThreadMessage(
        message({ senderRole: "applicant", senderUserId: "customer-1" }),
        "internal",
        staffA,
      ),
      false,
    );
  });
});
