import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  CRYPTO_PRELAUNCH_RESET_CONFIRM_ENV,
  CRYPTO_PRELAUNCH_RESET_CONFIRM_VALUE,
  CryptoPrelaunchResetError,
  assertCryptoPrelaunchResetAllowed,
} from "./crypto-prelaunch-reset.service";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("assertCryptoPrelaunchResetAllowed", () => {
  it("throws for NODE_ENV=production", () => {
    assert.throws(
      () =>
        assertCryptoPrelaunchResetAllowed({
          NODE_ENV: "production",
          CONFIRM_TERMINAL_CRYPTO_PRELAUNCH_RESET: CRYPTO_PRELAUNCH_RESET_CONFIRM_VALUE,
        }),
      (err: unknown) =>
        err instanceof CryptoPrelaunchResetError && /production/i.test(err.message),
    );
  });

  it("throws for VERCEL_ENV=production", () => {
    assert.throws(
      () =>
        assertCryptoPrelaunchResetAllowed({
          NODE_ENV: "development",
          VERCEL_ENV: "production",
          CONFIRM_TERMINAL_CRYPTO_PRELAUNCH_RESET: CRYPTO_PRELAUNCH_RESET_CONFIRM_VALUE,
        }),
      (err: unknown) =>
        err instanceof CryptoPrelaunchResetError && /production/i.test(err.message),
    );
  });

  it("throws for ALTA_ENV=production", () => {
    assert.throws(
      () =>
        assertCryptoPrelaunchResetAllowed({
          NODE_ENV: "development",
          ALTA_ENV: "production",
          CONFIRM_TERMINAL_CRYPTO_PRELAUNCH_RESET: CRYPTO_PRELAUNCH_RESET_CONFIRM_VALUE,
        }),
      (err: unknown) =>
        err instanceof CryptoPrelaunchResetError && /production/i.test(err.message),
    );
  });

  it("allows development when confirm=YES", () => {
    assert.doesNotThrow(() =>
      assertCryptoPrelaunchResetAllowed({
        NODE_ENV: "development",
        CONFIRM_TERMINAL_CRYPTO_PRELAUNCH_RESET: CRYPTO_PRELAUNCH_RESET_CONFIRM_VALUE,
      }),
    );
  });

  it("allows test when confirm=YES", () => {
    assert.doesNotThrow(() =>
      assertCryptoPrelaunchResetAllowed({
        NODE_ENV: "test",
        VERCEL_ENV: "preview",
        ALTA_ENV: "staging",
        CONFIRM_TERMINAL_CRYPTO_PRELAUNCH_RESET: CRYPTO_PRELAUNCH_RESET_CONFIRM_VALUE,
      }),
    );
  });

  it("refuses without confirm flag", () => {
    assert.throws(
      () =>
        assertCryptoPrelaunchResetAllowed({
          NODE_ENV: "development",
        }),
      (err: unknown) =>
        err instanceof CryptoPrelaunchResetError &&
        err.message.includes(CRYPTO_PRELAUNCH_RESET_CONFIRM_ENV),
    );
  });

  it("refuses confirm values other than exact YES", () => {
    for (const bad of ["yes", "Yes", "true", "1", " YES "]) {
      assert.throws(
        () =>
          assertCryptoPrelaunchResetAllowed({
            NODE_ENV: "development",
            CONFIRM_TERMINAL_CRYPTO_PRELAUNCH_RESET: bad,
          }),
        CryptoPrelaunchResetError,
      );
    }
  });
});

describe("prelaunch reset script source guards", () => {
  it("mentions CONFIRM_TERMINAL_CRYPTO_PRELAUNCH_RESET and refuses production", () => {
    const script = read("scripts/reset-terminal-crypto-prelaunch.ts");
    assert.match(script, /CONFIRM_TERMINAL_CRYPTO_PRELAUNCH_RESET/);
    assert.match(script, /production/);
    assert.match(script, /isCryptoPrelaunchResetProductionEnv|ALTA_ENV|VERCEL_ENV/);
    assert.match(script, /--apply/);
    assert.match(script, /DRY-RUN|Dry run/i);

    const pkg = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };
    assert.equal(
      pkg.scripts["db:reset-terminal-crypto-prelaunch"],
      "tsx scripts/reset-terminal-crypto-prelaunch.ts",
    );
    assert.doesNotMatch(pkg.scripts.postinstall ?? "", /reset-terminal-crypto-prelaunch/);
  });

  it("service targets only launch symbols and uses CRYPTO_ASSET_CONFIGS", () => {
    const service = read("src/lib/terminal/crypto/crypto-prelaunch-reset.service.ts");
    assert.match(service, /LAUNCH_ASSET_SYMBOLS/);
    assert.match(service, /CRYPTO_ASSET_CONFIGS/);
    assert.match(service, /curveRateSeedString/);
    assert.match(service, /assertCryptoPrelaunchResetAllowed/);
    assert.match(service, /resetTerminalCryptoPrelaunchMarket/);
    assert.match(service, /terminalCryptoWalletBalance/);
    assert.match(service, /status:\s*"ACTIVE"/);
    assert.match(service, /go_live_activate_/);
  });
});
