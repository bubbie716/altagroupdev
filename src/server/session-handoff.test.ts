import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hostsMatch } from "@/server/session-handoff";

describe("session-handoff", () => {
  it("treats www and apex as the same host", () => {
    assert.equal(
      hostsMatch("newportclearingcorporation.com", "www.newportclearingcorporation.com"),
      true,
    );
  });

  it("does not match different domains", () => {
    assert.equal(hostsMatch("altagroup.dev", "newportclearingcorporation.com"), false);
  });
});
