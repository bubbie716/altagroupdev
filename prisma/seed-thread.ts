import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const carter = await db.user.findFirst({ where: { name: { contains: "Carter", mode: "insensitive" } } });
  console.log("carter:", carter?.id, carter?.name, carter?.email);
  const apps = await db.loanApplication.findMany({ where: { applicantUserId: carter?.id }, take: 5, select: { id: true, status: true, requestedAmount: true, createdAt: true } });
  console.log("apps:", apps);
  const threads = await db.loanApplicationThread.findMany({ where: { applicantUserId: carter?.id }, take: 5, include: { messages: { take: 20 } } });
  console.log("threads count:", threads.length);
  for (const t of threads) {
    console.log("thread", t.id, "appId", t.loanApplicationId, "status", t.status, "msgs", t.messages.length);
  }
}
main().finally(() => db.$disconnect());
