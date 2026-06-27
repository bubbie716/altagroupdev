import { backfillAltaCardApplicationApprovalMessages } from "../src/server/alta-card-application-thread.service";

async function main() {
  console.log("Backfilling Alta Card application approval deal room messages…");
  const result = await backfillAltaCardApplicationApprovalMessages();
  console.log(`Updated ${result.updated} message(s).`);
  if (result.skipped > 0) {
    console.log(`Skipped ${result.skipped} message(s) missing approved terms on the application record.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../src/server/db");
    await prisma.$disconnect();
  });
