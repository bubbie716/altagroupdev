import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const users = await db.user.findMany({ where: { OR: [{ discordUsername: { contains: "carter", mode: "insensitive" } }, { email: { contains: "carter", mode: "insensitive" } }] } });
  console.log("users:", users.map(u => ({ id: u.id, du: u.discordUsername, email: u.email })));
  const apps = await db.loanApplication.findMany({ take: 10, select: { id: true, status: true, requestedAmount: true, applicantUserId: true, productType: true } });
  console.log("apps sample:", apps);
  const threads = await db.loanApplicationThread.findMany({ take: 10, select: { id: true, applicantUserId: true, loanApplicationId: true, status: true } });
  console.log("threads:", threads);
}
main().finally(() => db.$disconnect());
