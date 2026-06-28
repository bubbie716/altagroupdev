import { backfillAllRelationshipTimelinesCore } from "../src/server/relationship-timeline.service";

async function main() {
  const userIdArg = process.argv.find((arg) => arg.startsWith("--user="))?.slice("--user=".length);

  if (userIdArg) {
    const { backfillRelationshipTimelineCore } = await import(
      "../src/server/relationship-timeline.service"
    );
    console.log(`Backfilling relationship timeline for user ${userIdArg}…`);
    const created = await backfillRelationshipTimelineCore(userIdArg);
    console.log(`Created ${created} timeline event(s).`);
    return;
  }

  console.log("Backfilling relationship timelines for all users…");
  const result = await backfillAllRelationshipTimelinesCore();
  console.log(
    `Processed ${result.processed} user(s), created ${result.eventsCreated} event(s), ${result.failed} failed.`,
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
