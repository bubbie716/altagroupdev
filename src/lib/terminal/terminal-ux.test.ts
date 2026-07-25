import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src");

describe("terminal sign-in experience", () => {
  it("ships a Terminal-specific sign-in page with required copy and Discord CTA", () => {
    const source = readFileSync(
      join(root, "components/terminal/terminal-sign-in-page.tsx"),
      "utf8",
    );
    assert.match(source, /Invest in Newport/);
    assert.match(source, /Continue with Discord/);
    assert.match(source, /Alta Terminal/);
    assert.match(source, /DiscordSignInButton/);
    assert.match(source, /redirectTo/);
  });

  it("routes Terminal root login through the Terminal sign-in page only", () => {
    const entityLogin = readFileSync(join(root, "components/site/entity-login-page.tsx"), "utf8");
    assert.match(entityLogin, /TerminalSignInPage/);
    assert.match(entityLogin, /site\.key === "terminal"/);
    assert.match(entityLogin, /AuthGate/);
  });

  it("preserves OAuth redirect query on Discord authorize", () => {
    const authGate = readFileSync(join(root, "components/auth/auth-gate.tsx"), "utf8");
    assert.match(
      authGate,
      /\/api\/auth\/discord\?redirect=\$\{encodeURIComponent\(redirectTo\)\}/,
    );
  });
});

describe("terminal header ecosystem launcher", () => {
  it("uses a single branded ecosystem switcher in the Terminal header", () => {
    const shell = readFileSync(join(root, "components/terminal/terminal-app-shell.tsx"), "utf8");
    assert.match(shell, /variant="branded"/);
    assert.equal(shell.includes('to="/terminal"\n          className="flex shrink-0 items-center gap-2"'), false);
    // No second text-only EcosystemSwitcher beside market status
    const switcherCount = (shell.match(/EcosystemSwitcher/g) ?? []).length;
    assert.equal(switcherCount, 2); // import + one usage
  });
});

describe("home vs portfolio separation", () => {
  it("keeps full holdings chart off the Home route", () => {
    const home = readFileSync(join(root, "routes/terminal/index.tsx"), "utf8");
    assert.doesNotMatch(home, /PortfolioChart/);
    assert.doesNotMatch(home, /HoldingsTable/);
    assert.match(home, /HomePortfolioCard/);
    assert.match(home, /combinedValue/);
  });

  it("renders detailed portfolio tools on the portfolio detail route", () => {
    const detail = readFileSync(
      join(root, "routes/terminal/portfolio/$portfolioId.tsx"),
      "utf8",
    );
    assert.match(detail, /PortfolioChart/);
    assert.match(detail, /HoldingsTable/);
    assert.match(detail, /PortfolioSwitcher/);
    assert.match(detail, /variant="heading"/);
    assert.doesNotMatch(detail, /PortfolioOwnerBadge/);
    assert.match(detail, /AllocationBars/);
  });
});

describe("portfolio detail heading switcher", () => {
  it("uses a single heading trigger without a duplicate title stack", () => {
    const detail = readFileSync(
      join(root, "routes/terminal/portfolio/$portfolioId.tsx"),
      "utf8",
    );
    const switcher = readFileSync(
      join(root, "components/terminal/portfolio-switcher.tsx"),
      "utf8",
    );
    // Exactly one JSX switcher on the loaded detail header; no owner badge.
    assert.equal((detail.match(/<PortfolioSwitcher[\s\n]/g) ?? []).length, 1);
    assert.doesNotMatch(detail, /PortfolioOwnerBadge/);
    // Main success branch: switcher owns the title — no sibling h1 next to it.
    assert.doesNotMatch(
      detail,
      /<PortfolioSwitcher[\s\S]*?<\/div>\s*<h1[\s>]/,
    );
    assert.match(switcher, /variant === "heading"/);
    assert.match(switcher, /Current portfolio:/);
    assert.match(switcher, /<h1 /);
    assert.match(switcher, /pendingHeadingFocusId/);
    assert.match(switcher, /asChild/);
    assert.match(switcher, /variant === "heading"[\s\S]*?triggerRef\.current\?\.focus/);
  });
});
