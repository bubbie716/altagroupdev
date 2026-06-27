import {
  backfillCancelledReviewThreadMessages,
  backfillCooldownReviewThreadMessages,
} from "../src/server/alta-card-review-thread.service";

async function main() {
  console.log("Backfilling cancelled account review deal room messages…");
  const cancelled = await backfillCancelledReviewThreadMessages();
  console.log(`Updated ${cancelled.updated} cancelled message(s).`);

  console.log("Backfilling approved/denied account review deal room messages…");
  const cooldown = await backfillCooldownReviewThreadMessages();
  console.log(`Updated ${cooldown.updated} cooldown message(s).`);
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
