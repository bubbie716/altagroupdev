import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  formatPortfolioOwnerLine,
  formatPortfolioTicketLabel,
  groupSecurityPortfolios,
  tradeBlockReason,
  type SecurityPortfolioOption,
} from "@/lib/terminal/security-portfolio-picker";
import { focusDialogCloseButton } from "@/lib/ui/focus-dialog-close";

const root = join(process.cwd(), "src");

function option(
  partial: Partial<SecurityPortfolioOption> &
    Pick<SecurityPortfolioOption, "id" | "name" | "ownerType">,
): SecurityPortfolioOption {
  return {
    ownerUserId: partial.ownerType === "personal" ? "u1" : null,
    ownerCompanyId: partial.ownerType === "company" ? "CO-ALTG" : null,
    ownerLabel: partial.ownerType === "personal" ? "Personal" : "Alta Group N.V.",
    status: "active",
    isDefault: false,
    totalValue: 10_000,
    dayChange: 0,
    dayChangePercent: 0,
    buyingPower: 5_000,
    holdingQuantity: 0,
    capabilities: {
      canView: true,
      canTrade: true,
      canRename: true,
      canArchive: true,
    },
    ...partial,
  };
}

describe("security page portfolio placement", () => {
  it("does not render a standalone PortfolioSwitcher in the security header", () => {
    const page = readFileSync(join(root, "routes/terminal/security/$symbol.tsx"), "utf8");
    assert.doesNotMatch(page, /PortfolioSwitcher/);
    assert.match(page, /SecurityPortfolioPicker/);
    assert.match(page, /Add to Watchlist/);
    assert.match(page, /Your position/);
    assert.match(page, /No position in this portfolio/);
  });

  it("renders desktop and mobile order chrome together with CSS visibility toggles", () => {
    const page = readFileSync(join(root, "routes/terminal/security/$symbol.tsx"), "utf8");
    assert.match(page, /MobileOrderEntry/);
    assert.match(page, /hidden lg:sticky lg:top-20 lg:block/);
    assert.match(page, /className="lg:hidden"/);
    assert.doesNotMatch(page, /useMediaQueryMax/);
    assert.doesNotMatch(page, /isMobileLayout \?/);
    assert.match(page, /useOrderTicketDraft/);
  });

  it("order ticket exposes an interactive portfolio control and shared draft", () => {
    const ticket = readFileSync(join(root, "components/terminal/order-ticket.tsx"), "utf8");
    assert.match(ticket, /SecurityPortfolioTrigger/);
    assert.match(ticket, /onRequestPortfolioChange/);
    assert.match(ticket, /draft\?:/);
    assert.match(ticket, /Row label="Portfolio"/);
    assert.match(ticket, /Select a portfolio before trading/);
  });

  it("picker groups personal and company portfolios and marks trade blocks", () => {
    const portfolios = [
      option({ id: "p1", name: "Core", ownerType: "personal", holdingQuantity: 2 }),
      option({ id: "p2", name: "Growth", ownerType: "personal" }),
      option({
        id: "c1",
        name: "ALTG Treasury",
        ownerType: "company",
        ownerLabel: "Alta Group N.V.",
      }),
      option({
        id: "c2",
        name: "View only",
        ownerType: "company",
        capabilities: {
          canView: true,
          canTrade: false,
          canRename: false,
          canArchive: false,
        },
      }),
    ];
    const grouped = groupSecurityPortfolios(portfolios);
    assert.equal(grouped.personal.length, 2);
    assert.equal(grouped.company.length, 2);
    assert.equal(formatPortfolioOwnerLine(portfolios[0]!), "Personal");
    assert.equal(formatPortfolioTicketLabel(portfolios[2]!), "ALTG Treasury · Alta Group N.V.");
    assert.equal(tradeBlockReason(portfolios[3]!), "View only — trading not permitted");
    assert.equal(tradeBlockReason(portfolios[0]!), null);
  });

  it("picker uses a single Dialog tree with CSS mobile sheet positioning", () => {
    const page = readFileSync(join(root, "routes/terminal/security/$symbol.tsx"), "utf8");
    const picker = readFileSync(
      join(root, "components/terminal/security-portfolio-picker.tsx"),
      "utf8",
    );
    assert.match(page, /closeThenRun/);
    assert.match(page, /portfolioId: nextId/);
    assert.match(page, /restorePickerTriggerFocus/);
    assert.match(page, /onCloseAutoFocus/);
    assert.match(page, /lastPickerTriggerRef/);
    assert.doesNotMatch(page, /setTimeout/);
    assert.match(picker, /Dialog/);
    assert.doesNotMatch(picker, /useMediaQueryMax/);
    assert.doesNotMatch(picker, /from "@\/components\/ui\/sheet"/);
    assert.match(picker, /max-lg:bottom-/);
    assert.match(picker, /Choose portfolio/);
    assert.match(picker, /Manage portfolios/);
    assert.match(picker, /focusDialogCloseButton/);
    assert.match(picker, /onCloseAutoFocus\?:/);
    assert.doesNotMatch(picker, /DropdownMenu/);
  });
});

describe("mobile terminal accessibility pass", () => {
  it("syncs chart range through the security URL search param", () => {
    const page = readFileSync(join(root, "routes/terminal/security/$symbol.tsx"), "utf8");
    assert.match(page, /range: next/);
    assert.match(page, /portfolioId/);
    const chart = readFileSync(join(root, "components/terminal/portfolio-chart.tsx"), "utf8");
    assert.match(chart, /onRangeChange/);
  });

  it("keeps both search UIs in the SSR tree with CSS toggles at 360px", () => {
    const shell = readFileSync(join(root, "components/terminal/terminal-app-shell.tsx"), "utf8");
    assert.doesNotMatch(shell, /useMediaQueryMax/);
    assert.match(shell, /min-\[360px\]:hidden/);
    assert.match(shell, /min-\[360px\]:block/);
    assert.match(shell, /Search symbols/);
    assert.match(shell, /side="top"/);
    assert.match(shell, /closeThenRun/);
  });

  it("offsets SiteNav below the measured UI Lab banner height", () => {
    const nav = readFileSync(join(root, "components/site-nav.tsx"), "utf8");
    const rootFile = readFileSync(join(root, "routes/__root.tsx"), "utf8");
    assert.match(nav, /--ui-lab-banner-height/);
    assert.match(rootFile, /--ui-lab-banner-height/);
    assert.match(rootFile, /ResizeObserver/);
  });

  it("enlarges sheet/dialog close controls to a 44px hit target with data-dialog-close", () => {
    const sheet = readFileSync(join(root, "components/ui/sheet.tsx"), "utf8");
    const dialog = readFileSync(join(root, "components/ui/dialog.tsx"), "utf8");
    assert.match(sheet, /size-11/);
    assert.match(dialog, /size-11/);
    assert.match(sheet, /data-dialog-close/);
    assert.match(dialog, /data-dialog-close/);
    assert.match(sheet, /focus-visible:ring-2/);
  });

  it("focuses the close control via focusDialogCloseButton helper", () => {
    const order = readFileSync(join(root, "components/terminal/mobile-order-entry.tsx"), "utf8");
    assert.match(order, /focusDialogCloseButton/);
    assert.doesNotMatch(order, /data-order-sheet-title/);

    const host = { focused: null as HTMLElement | null };
    const close = {
      focus() {
        host.focused = close as unknown as HTMLElement;
      },
    };
    const container = {
      querySelector(sel: string) {
        return sel === "[data-dialog-close]" ? close : null;
      },
    };
    focusDialogCloseButton(container as unknown as EventTarget);
    assert.equal(host.focused, close);
  });

  it("gives chart range pills a 44px minimum touch target", () => {
    const range = readFileSync(join(root, "components/terminal/range-selector.tsx"), "utf8");
    assert.match(range, /min-h-11/);
    assert.match(range, /min-w-11/);
  });

  it("uses a shorter security chart height under 360px", () => {
    const chart = readFileSync(join(root, "components/terminal/portfolio-chart.tsx"), "utf8");
    assert.match(chart, /100svh-29rem/);
    assert.match(chart, /min-\[360px\]:h-\[188px\]/);
  });
});
