import type { Company } from "@/lib/auth/types";

/** Mock company registry — replace with database lookups in production. */
export const MOCK_COMPANIES: Company[] = [
  {
    id: "CO-NPC",
    name: "Newport Petroleum Corp.",
    type: "Listed Company",
    ticker: "NPC",
    sector: "Energy",
    status: "Listed",
    verificationStatus: "Verified",
  },
  {
    id: "CO-HBR",
    name: "Harbor Logistics Ltd.",
    type: "Private Company",
    ticker: null,
    sector: "Industrials",
    status: "Active",
    verificationStatus: "Verified",
  },
  {
    id: "CO-PRTH",
    name: "Port Haven Maritime",
    type: "Private Company",
    ticker: "PRTH",
    sector: "Industrials",
    status: "Active",
    verificationStatus: "Verified",
  },
  {
    id: "CO-HLXD",
    name: "Helix Dynamics Ltd.",
    type: "Issuer",
    ticker: "HLXD",
    sector: "Technology",
    status: "Pending",
    verificationStatus: "Pending Review",
  },
  {
    id: "CO-ALTB",
    name: "Alta Bank Holdings",
    type: "Bank",
    ticker: "ALTB",
    sector: "Financials",
    status: "Listed",
    verificationStatus: "Verified",
  },
];

export function getMockCompany(id: string): Company | undefined {
  return MOCK_COMPANIES.find((c) => c.id === id);
}
