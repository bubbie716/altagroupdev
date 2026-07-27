import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import {
  disableRelationshipBackgroundRefresh,
  drainRelationshipRefreshTasks,
  enableRelationshipBackgroundRefresh,
  getPendingRelationshipRefreshTaskCount,
  refreshUserRelationshipProfileBestEffort,
} from "@/server/relationship-refresh-hooks.service";

describe("relationship refresh background boundary", () => {
  after(() => {
    enableRelationshipBackgroundRefresh();
  });

  it("disable prevents scheduling so teardown cannot race", async () => {
    disableRelationshipBackgroundRefresh();
    await refreshUserRelationshipProfileBestEffort("user-does-not-matter", "test-disabled");
    assert.equal(getPendingRelationshipRefreshTaskCount(), 0);
    await drainRelationshipRefreshTasks();
    assert.equal(getPendingRelationshipRefreshTaskCount(), 0);
  });
});
