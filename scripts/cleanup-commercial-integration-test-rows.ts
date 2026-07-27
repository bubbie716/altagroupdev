/**
 * Narrow, opt-in cleanup for rows unmistakably created by commercial
 * integration tests. Does NOT run automatically.
 *
 * Usage (dry-run by default):
 *   npx tsx scripts/cleanup-commercial-integration-test-rows.ts
 *   npx tsx scripts/cleanup-commercial-integration-test-rows.ts --apply
 */
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");

async function main() {
  const prisma = new PrismaClient();
  try {
    const companies = await prisma.company.findMany({
      where: {
        OR: [
          { name: { startsWith: "Billing Concurrency Co " } },
          { name: { startsWith: "InvPayLink IT " } },
        ],
      },
      select: { id: true, name: true },
    });

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { discordId: { startsWith: "test-billing-" } },
          { discordId: { startsWith: "test-invpay-" } },
          { discordId: { startsWith: "test-payer-" } },
        ],
      },
      select: { id: true, discordId: true },
    });

    console.log(
      `[cleanup-commercial-integration-test-rows] found ${companies.length} companies, ${users.length} users`,
    );
    for (const company of companies) {
      console.log(`  company ${company.id} (${company.name})`);
    }
    for (const user of users) {
      console.log(`  user ${user.id} (${user.discordId})`);
    }

    if (!APPLY) {
      console.log("Dry run only. Re-run with --apply to delete these fixtures.");
      return;
    }

    const companyIds = companies.map((c) => c.id);
    const userIds = users.map((u) => u.id);

    if (companyIds.length) {
      await prisma.commercialSubscriptionCharge.deleteMany({
        where: { companyId: { in: companyIds } },
      });
      await prisma.paymentLinkPayment.deleteMany({
        where: { paymentLink: { merchantCompanyId: { in: companyIds } } },
      });
      await prisma.paymentLinkEvent.deleteMany({
        where: { paymentLink: { merchantCompanyId: { in: companyIds } } },
      });
      await prisma.paymentLink.deleteMany({
        where: { merchantCompanyId: { in: companyIds } },
      });
      await prisma.merchantInvoicePayment.deleteMany({
        where: { invoice: { merchantCompanyId: { in: companyIds } } },
      });
      await prisma.merchantInvoiceEvent.deleteMany({
        where: { invoice: { merchantCompanyId: { in: companyIds } } },
      });
      await prisma.merchantInvoiceLineItem.deleteMany({
        where: { invoice: { merchantCompanyId: { in: companyIds } } },
      });
      await prisma.merchantInvoice.deleteMany({
        where: { merchantCompanyId: { in: companyIds } },
      });
      await prisma.bankTransaction.deleteMany({
        where: { bankAccount: { companyId: { in: companyIds } } },
      });
      await prisma.company.updateMany({
        where: { id: { in: companyIds } },
        data: { commercialBillingAccountId: null },
      });
      await prisma.bankAccount.deleteMany({ where: { companyId: { in: companyIds } } });
      await prisma.companyMembership.deleteMany({ where: { companyId: { in: companyIds } } });
      await prisma.company.deleteMany({ where: { id: { in: companyIds } } });
    }

    if (userIds.length) {
      try {
        await prisma.relationshipRecommendation.deleteMany({
          where: { userId: { in: userIds } },
        });
        await prisma.relationshipProfileSnapshot.deleteMany({
          where: { userId: { in: userIds } },
        });
        await prisma.relationshipProfile.deleteMany({
          where: { userId: { in: userIds } },
        });
      } catch {
        // Optional relationship-intelligence tables.
      }
      await prisma.bankTransaction.deleteMany({
        where: { bankAccount: { userId: { in: userIds }, companyId: null } },
      });
      await prisma.bankAccount.deleteMany({
        where: { userId: { in: userIds }, companyId: null },
      });
      await prisma.companyMembership.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }

    console.log("Deleted matching integration-test fixtures.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
