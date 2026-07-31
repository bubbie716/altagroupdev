/**
 * Single UI Lab Terminal portfolio identity catalog.
 * Customer Terminal pages, funding eligibility, and internal ops must share these IDs.
 */
import { UI_LAB_MOCK_USER } from "@/lib/auth/ui-lab";
import { UI_LAB_CORE_COMPANY_ID } from "@/lib/bank/ui-lab-commercial-fixtures";
import { mockPortfolioIds } from "@/lib/terminal/ui-lab/ui-lab-terminal-market-fixtures";

const ids = mockPortfolioIds(UI_LAB_MOCK_USER.id);

export const UI_LAB_TERMINAL_PORTFOLIO_IDS = {
  personalCore: ids.personalCore,
  personalGrowth: ids.personalGrowth,
  personalIncome: ids.personalIncome,
  personalActive: ids.personalActive,
  personalEmpty: `tp_${UI_LAB_MOCK_USER.id}_empty`,
  companyTreasury: ids.companyAltg,
  archived: `tp_${UI_LAB_MOCK_USER.id}_archived`,
} as const;

export const UI_LAB_TERMINAL_FUNDING_ACCOUNT_IDS = {
  personalChecking: "BA-LAB-CHK",
  companyOperating: "BA-LAB-ALTG-OP",
  frozenReserve: "BA-LAB-FROZEN",
} as const;

export const UI_LAB_TERMINAL_FUNDING_OWNER_IDS = {
  userId: UI_LAB_MOCK_USER.id,
  companyId: UI_LAB_CORE_COMPANY_ID,
} as const;

export const UI_LAB_TERMINAL_FUNDING_TRANSFER_IDS = {
  bankToTerminal: "TFT-LAB-1",
  terminalToBank: "TFT-LAB-2",
} as const;

export const UI_LAB_TERMINAL_FUNDING_REFERENCE_CODES = {
  bankToTerminal: "TFD-LAB-0001",
  terminalToBank: "TFD-LAB-0002",
} as const;
