import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("ops global search person-linked accounts", () => {
  it("searches bank accounts by owner discord/minecraft username", () => {
    const src = readFileSync(join(root, "server/ops-global-search.service.ts"), "utf8");
    assert.match(src, /bankAccount\.findMany/);
    assert.match(
      src,
      /user:\s*\{\s*discordUsername:\s*\{\s*contains:\s*q/s,
    );
    assert.match(
      src,
      /user:\s*\{\s*minecraftUsername:\s*\{\s*contains:\s*q/s,
    );
  });

  it("searches deal rooms and lending apps by applicant/borrower username", () => {
    const src = readFileSync(join(root, "server/ops-global-search.service.ts"), "utf8");
    assert.match(src, /borrowerUser:\s*\{\s*discordUsername/);
    assert.match(src, /applicantUser:\s*\{\s*discordUsername/);
  });
});
