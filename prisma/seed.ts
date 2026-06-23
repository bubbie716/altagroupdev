import {
  CompanyRole,
  CompanyStatus,
  CompanyType,
  PrismaClient,
  VerificationStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

const companies = [
  {
    id: "CO-NPC",
    name: "Newport Petroleum Corp.",
    type: CompanyType.LISTED_COMPANY,
    ticker: "NPC",
    sector: "Energy",
    status: CompanyStatus.LISTED,
    verificationStatus: VerificationStatus.VERIFIED,
  },
  {
    id: "CO-HBR",
    name: "Harbor Logistics Ltd.",
    type: CompanyType.PRIVATE_COMPANY,
    ticker: null,
    sector: "Industrials",
    status: CompanyStatus.ACTIVE,
    verificationStatus: VerificationStatus.VERIFIED,
  },
  {
    id: "CO-PRTH",
    name: "Port Haven Maritime",
    type: CompanyType.PRIVATE_COMPANY,
    ticker: "PRTH",
    sector: "Industrials",
    status: CompanyStatus.ACTIVE,
    verificationStatus: VerificationStatus.VERIFIED,
  },
  {
    id: "CO-HLXD",
    name: "Helix Dynamics Ltd.",
    type: CompanyType.ISSUER,
    ticker: "HLXD",
    sector: "Technology",
    status: CompanyStatus.PENDING,
    verificationStatus: VerificationStatus.PENDING,
  },
  {
    id: "CO-ALTB",
    name: "Alta Bank Holdings",
    type: CompanyType.BANK,
    ticker: "ALTB",
    sector: "Financials",
    status: CompanyStatus.LISTED,
    verificationStatus: VerificationStatus.VERIFIED,
  },
] as const;

const devMemberships: Record<string, { companyId: string; role: CompanyRole }[]> = {
  "000000000000000001": [{ companyId: "CO-NPC", role: CompanyRole.FINANCE_MANAGER }],
  "000000000000000002": [
    { companyId: "CO-PRTH", role: CompanyRole.EXECUTIVE },
    { companyId: "CO-HBR", role: CompanyRole.OWNER },
  ],
  "000000000000000003": [{ companyId: "CO-ALTB", role: CompanyRole.COMPLIANCE_CONTACT }],
  "000000000000000004": [{ companyId: "CO-HLXD", role: CompanyRole.OWNER }],
  "000000000000000005": [{ companyId: "CO-PRTH", role: CompanyRole.OWNER }],
};

async function main() {
  for (const company of companies) {
    await prisma.company.upsert({
      where: { id: company.id },
      create: company,
      update: {
        name: company.name,
        type: company.type,
        ticker: company.ticker,
        sector: company.sector,
        status: company.status,
        verificationStatus: company.verificationStatus,
      },
    });
  }

  console.log(`Seeded ${companies.length} companies.`);

  for (const [discordId, memberships] of Object.entries(devMemberships)) {
    const user = await prisma.user.findUnique({ where: { discordId } });
    if (!user) continue;

    for (const membership of memberships) {
      await prisma.companyMembership.upsert({
        where: {
          userId_companyId: { userId: user.id, companyId: membership.companyId },
        },
        create: {
          userId: user.id,
          companyId: membership.companyId,
          role: membership.role,
        },
        update: { role: membership.role },
      });
    }
  }

  console.log("Dev membership sync complete (for users that already exist).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
