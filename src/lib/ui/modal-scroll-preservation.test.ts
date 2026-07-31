import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

describe("site-wide modal scroll preservation", () => {
  it("guards both shared overlay primitives", () => {
    const dialog = read("components/ui/dialog.tsx");
    const sheet = read("components/ui/sheet.tsx");

    for (const source of [dialog, sheet]) {
      assert.match(source, /useOverlayScrollGuard/);
      assert.match(source, /onOpenAutoFocus=\{handleOpenAutoFocus\}/);
      assert.match(source, /onCloseAutoFocus=\{handleCloseAutoFocus\}/);
      assert.match(source, /modal = false/);
    }
  });

  it("restores focus without scrolling the document", () => {
    const guard = read("lib/ui/overlay-scroll-guard.ts");
    assert.match(guard, /focus\(\{ preventScroll: true \}\)/);
    assert.match(guard, /restoreViewportPosition/);
    assert.match(guard, /window\.location\.pathname !== position\.pathname/);
  });

  it("keeps route-driven Bank actions at the current scroll position", () => {
    const launcher = read("components/bank/actions/use-bank-action-launcher.ts");
    assert.equal((launcher.match(/resetScroll:\s*false/g) ?? []).length, 2);
    assert.match(launcher, /focus\?\.\(\{ preventScroll: true \}\)/);
  });

  it("routes bespoke confirmation and settings modals through the shared primitive", () => {
    const opsConfirm = read("components/internal/ops-confirm-dialog.tsx");
    const portfolio = read("routes/terminal/portfolio/$portfolioId.tsx");
    assert.match(opsConfirm, /<Dialog[\s\S]*<DialogContent/);
    assert.doesNotMatch(opsConfirm, /createPortal|document\.body\.style\.overflow/);
    assert.match(portfolio, /open=\{settingsOpen\}[\s\S]*<DialogContent/);
    assert.doesNotMatch(portfolio, /role="dialog"/);
  });
});
