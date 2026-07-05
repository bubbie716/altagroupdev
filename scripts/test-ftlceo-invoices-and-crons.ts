/**
 * One-off dev helper: send test invoices to FTLCEO and hit cron endpoints.
 * Usage: npx tsx scripts/test-ftlceo-invoices-and-crons.ts
 */
import { readFileSync } from "node:fs";

const FTLCEO_USER_ID = "cmqpw8w1l0000uknfiy6dy83z";
const MERCHANT_COMPANY_ID = "cmqq4idhn0000ukjr8d4mjge1";

async function runCrons() {
  const env = readFileSync(".env", "utf8");
  const secretMatch = env.match(/^CRON_SECRET=(.+)$/m);
  const secret = (secretMatch?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
  if (!secret) {
    console.warn("CRON_SECRET missing — skipping cron calls");
    return;
  }
  const base = process.env.CRON_TEST_BASE ?? "http://localhost:3000";
  for (const path of [
    "/api/cron/scheduled-transfers",
    "/api/cron/daily-servicing",
    "/api/cron/relationship-intelligence",
  ]) {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const text = await res.text();
    console.log(`\n=== ${path} → HTTP ${res.status} ===`);
    try {
      console.log(JSON.stringify(JSON.parse(text), null, 2).slice(0, 1200));
    } catch {
      console.log(text.slice(0, 400));
    }
  }
}

async function main() {
  const { loadAltaUserOrThrow } = await import("@/server/bank-account-access.service");
  const { createMerchantInvoiceDraft, sendMerchantInvoice } = await import(
    "@/server/merchant-invoice.service"
  );
  const { createRecurringInvoiceSchedule } = await import(
    "@/server/merchant-recurring-invoice.service"
  );
  const { createAltaPaySchedule } = await import("@/server/alta-pay-schedule.service");
  const { prisma } = await import("@/server/db");

  const merchantUser = await loadAltaUserOrThrow(FTLCEO_USER_ID);
  const merchantCompany = await prisma.company.findUnique({
    where: { id: MERCHANT_COMPANY_ID },
    select: {
      id: true,
      name: true,
      commercialPlan: true,
      bankAccounts: {
        where: { accountType: "BUSINESS_OPERATING", status: "ACTIVE" },
        take: 1,
      },
    },
  });
  if (!merchantCompany?.bankAccounts[0]) {
    throw new Error("Merchant company missing operating account");
  }

  console.log(`Merchant: ${merchantCompany.name} (${merchantCompany.commercialPlan})`);
  console.log(`Recipient: FTLCEO (${FTLCEO_USER_ID})\n`);

  const sent: { ref: string; amount: number; status: string }[] = [];
  const invoiceSpecs = [
    { amount: 250, description: "Cron test — consulting block A" },
    { amount: 175.5, description: "Cron test — platform fee B" },
    { amount: 89, description: "Cron test — support retainer C" },
    { amount: 1200, description: "Cron test — project milestone D" },
    { amount: 42, description: "Cron test — misc services E" },
  ];

  for (const spec of invoiceSpecs) {
    const draft = await createMerchantInvoiceDraft(merchantUser, {
      companyId: MERCHANT_COMPANY_ID,
      amount: spec.amount,
      description: spec.description,
      recipientUserId: FTLCEO_USER_ID,
      dueDate: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      memo: "Automated test batch",
    });
    const issued = await sendMerchantInvoice(
      merchantUser,
      MERCHANT_COMPANY_ID,
      draft.id,
      "test_script",
    );
    sent.push({ ref: issued.referenceCode, amount: spec.amount, status: issued.status });
    console.log(`Sent invoice ${issued.referenceCode} · ƒ${spec.amount}`);
  }

  const datePart = new Date().toISOString().slice(0, 10);
  try {
    const recurring = await createRecurringInvoiceSchedule(merchantUser, {
      companyId: MERCHANT_COMPANY_ID,
      templateName: "Cron smoke — weekly test",
      recipientUserId: FTLCEO_USER_ID,
      amount: 33,
      description: "Recurring cron smoke test",
      frequency: "weekly",
      startDate: datePart,
      autoSendEnabled: true,
    });
    console.log(`\nCreated recurring schedule ${recurring.id} · next ${recurring.nextRunDate}`);
    await prisma.merchantRecurringInvoiceSchedule.update({
      where: { id: recurring.id },
      data: { nextRunDate: new Date(Date.now() - 60_000) },
    });
    console.log("Backdated nextRunDate to trigger recurring invoice cron");
  } catch (err) {
    console.warn("Recurring schedule skipped:", err instanceof Error ? err.message : err);
  }

  try {
    const otherUser = await prisma.user.findFirst({
      where: { discordUsername: "carter", accountStatus: "ACTIVE" },
      select: { id: true },
    });
    const payerAccount = otherUser
      ? await prisma.bankAccount.findFirst({
          where: { userId: otherUser.id, companyId: null, status: "ACTIVE" },
        })
      : null;
    if (otherUser && payerAccount) {
      const payer = await loadAltaUserOrThrow(otherUser.id);
      const schedule = await createAltaPaySchedule(payer, {
        fundingSource: { kind: "bank_account", accountId: payerAccount.id },
        paymentType: "scheduled",
        payeeLabel: "FTLCEO",
        recipientUserId: FTLCEO_USER_ID,
        amount: 15,
        scheduledDate: datePart,
        scheduledTime: "09:00",
        memo: "Alta Pay cron smoke test",
      });
      await prisma.scheduledPayment.update({
        where: { id: schedule.id },
        data: { scheduledDate: new Date(Date.now() - 60_000), nextRunDate: null },
      });
      console.log(`\nCreated Alta Pay schedule ${schedule.id} (backdated for cron)`);
    }
  } catch (err) {
    console.warn("Alta Pay schedule skipped:", err instanceof Error ? err.message : err);
  }

  console.log("\n--- Invoice summary ---");
  console.log(JSON.stringify(sent, null, 2));

  console.log("\n--- Running crons ---");
  await runCrons();

  const inbox = await prisma.merchantInvoice.findMany({
    where: { recipientUserId: FTLCEO_USER_ID },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      referenceCode: true,
      status: true,
      amount: true,
      description: true,
      isRecurring: true,
      createdAt: true,
      merchantCompany: { select: { name: true } },
    },
  });
  console.log("\n--- FTLCEO recent received invoices ---");
  for (const row of inbox) {
    console.log(
      `${row.referenceCode} · ${row.status} · ƒ${row.amount} · ${row.merchantCompany.name} · ${row.description?.slice(0, 40)}`,
    );
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
