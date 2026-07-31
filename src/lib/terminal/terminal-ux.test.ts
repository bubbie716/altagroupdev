import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "src");

describe("terminal sign-in experience", () => {
  const signInSource = () =>
    readFileSync(join(root, "components/terminal/terminal-sign-in-page.tsx"), "utf8");

  const glowHookSource = () =>
    readFileSync(join(root, "hooks/use-terminal-pointer-glow.ts"), "utf8");

  const entranceCss = () => {
    const styles = readFileSync(join(root, "styles.css"), "utf8");
    const start = styles.indexOf("/* Terminal entrance");
    assert.ok(start >= 0, "terminal entrance CSS block missing");
    return styles.slice(start);
  };

  it("ships a Terminal-specific sign-in page with required copy and Discord CTA", () => {
    const source = signInSource();
    assert.match(source, /Invest in Newport/);
    assert.match(source, /Continue with Discord/);
    assert.match(source, /Alta Terminal/);
    assert.match(source, /DiscordSignInButton/);
    assert.match(source, /redirectTo/);
    assert.match(source, /TERMINAL ACCESS/);
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

  it("wires signed-out Discord CTA and signed-in continue destination without changing auth", () => {
    const source = signInSource();
    assert.match(source, /DiscordSignInButton[\s\S]*redirectTo=\{destination\}/);
    assert.match(source, /label="Continue with Discord"/);
    assert.match(source, /Continue to Terminal/);
    assert.match(
      source,
      /const destination = redirectTo\.startsWith\("\/"\) \? redirectTo : "\/terminal"/,
    );
    assert.match(source, /<Link[\s\S]*to=\{destination\}/);
    assert.doesNotMatch(source, /auto.?redirect|window\.location|navigate\(/i);
  });

  it("renders exactly one H1 in each auth branch and a single logo/name pair", () => {
    const source = signInSource();
    const h1Count = (source.match(/<h1[\s>]/g) ?? []).length;
    assert.equal(h1Count, 2, "expected one H1 in signed-out and one in signed-in branches");
    assert.match(source, /function SignedOutHero[\s\S]*?<h1[\s\S]*?Invest in Newport/);
    assert.match(source, /function SignedInContinue[\s\S]*?<h1[\s\S]*?Welcome back/);
    assert.match(
      source,
      /user && displayName \? \([\s\S]*?<SignedInContinue[\s\S]*?\) : \([\s\S]*?<SignedOutHero/,
    );
    assert.equal((source.match(/<AltaLogo[\s\S]*?\/>/g) ?? []).length, 1);
    assert.match(
      source,
      /<header[\s\S]*?<AltaLogo[\s\S]*?>[\s\S]*?Alta Terminal[\s\S]*?<\/span>[\s\S]*?<\/header>/,
    );
    assert.doesNotMatch(source, /AltaWordmark/);
    // No second branded logo/name cluster outside the header mark.
    assert.equal((source.match(/<AltaLogo/g) ?? []).length, 1);
  });

  it("implements cursor glow via ref + RAF CSS variables without React-per-pointer state", () => {
    const source = signInSource();
    const hook = glowHookSource();
    assert.match(source, /useTerminalPointerGlow\(rootRef\)/);
    assert.match(source, /--terminal-pointer-x/);
    assert.match(source, /--terminal-pointer-y/);
    assert.match(hook, /requestAnimationFrame/);
    assert.match(hook, /cancelAnimationFrame/);
    assert.match(hook, /pointer: fine/);
    assert.match(hook, /prefers-reduced-motion: reduce/);
    assert.match(hook, /visibilityState/);
    assert.match(hook, /removeEventListener\("pointermove"/);
    assert.match(hook, /style\.setProperty\("--terminal-pointer-x"/);
    assert.doesNotMatch(hook, /useState\(/);
    assert.doesNotMatch(hook, /setState|setPointer|setGlow|setCoords/);
  });

  it("disables fine-pointer tracking for coarse pointers and reduced motion", () => {
    const hook = glowHookSource();
    const css = entranceCss();
    assert.match(hook, /finePointer\.matches/);
    assert.match(hook, /!reducedMotion\.matches/);
    assert.match(css, /@media \(pointer: coarse\)/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(css, /--terminal-pointer-x:\s*62%/);
    assert.match(css, /--terminal-pointer-y:\s*38%/);
  });

  it("keeps the decorative graph accessible and free of fake financial claims", () => {
    const source = signInSource();
    assert.match(source, /terminal-entrance-backdrop[\s\S]*aria-hidden/);
    assert.match(source, /pointer-events-none/);
    assert.match(source, /MARKET_LINE_PATH/);
    assert.doesNotMatch(source, /\$\d|USD|volume|AAPL|TSLA|NVDA|ticker|bid|ask/i);
    assert.doesNotMatch(source, /price|shares|market cap|% gain|up \d/i);
    assert.doesNotMatch(source, /<text[\s>]/);
    assert.doesNotMatch(source, /<circle[\s>]/);
  });

  it("uses Terminal theme tokens for light/dark entrance atmosphere", () => {
    const source = signInSource();
    const css = entranceCss();
    assert.match(source, /terminal-shell/);
    assert.match(source, /useTheme/);
    assert.match(source, /Switch to \$\{theme === "dark" \? "light" : "dark"\} mode/);
    assert.match(css, /\.dark \.terminal-entrance-ambient/);
    assert.match(css, /\.dark \.terminal-entrance-pointer-glow/);
    assert.match(css, /var\(--terminal-green\)/);
    assert.match(css, /var\(--terminal-bg\)/);
  });

  it("keeps Legal & disclosures keyboard accessible with an opaque viewport-bounded panel", () => {
    const source = signInSource();
    const css = entranceCss();
    assert.match(source, /<details[\s\S]*Legal & disclosures/);
    assert.match(source, /fictional brokerage product/);
    assert.match(source, /live Newport TSE/);
    assert.match(source, /min-h-11/);
    assert.match(css, /\.terminal-entrance-disclosures-panel/);
    assert.match(css, /position:\s*absolute/);
    assert.match(css, /bottom:\s*calc\(100%/);
    assert.match(css, /max-height:\s*min\(/);
    assert.match(css, /background:\s*var\(--terminal-surface\)/);
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
    assert.match(home, /combinedValue|marketDataAvailable/);
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
