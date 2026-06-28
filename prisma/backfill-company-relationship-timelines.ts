import { backfillAllCompanyRelationshipTimelinesCore } from "../src/server/company-relationship-timeline.service";

async function main() {
  const companyIdArg = process.argv.find((arg) => arg.startsWith("--company="))?.slice("--company=".length);

  if (companyIdArg) {
    const { backfillCompanyRelationshipTimelineCore } = await import(
      "../src/server/company-relationship-timeline.service"
    );
    console.log(`Backfilling company relationship timeline for ${companyIdArg}…`);
    const created = await backfillCompanyRelationshipTimelineCore(companyIdArg);
    console.log(`Created ${created} timeline event(s).`);
    return;
  }

  console.log("Backfilling company relationship timelines for all companies…");
  const result = await backfillAllCompanyRelationshipTimelinesCore();
  console.log(
    `Processed ${result.processed} company(ies), created ${result.eventsCreated} event(s), ${result.failed} failed.`,
  );
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
