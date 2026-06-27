import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const carterId = "cmqpw8w1l0000uknfiy6dy83z";
  const threadId = "cmqu90jge0001ukjqmzcxsxsr";

  // Find any alta staff (or create system messages). Use first user with admin tag.
  const staff = await db.userTagAssignment.findFirst({ where: { tag: "ADMIN" as any } });
  const staffId = staff?.userId ?? carterId;

  const existing = await db.loanApplicationThreadMessage.count({ where: { threadId } });
  console.log("existing messages:", existing);

  const seedMessages: { senderUserId: string | null; senderRole: any; body: string | null; attachments: any }[] = [
    {
      senderUserId: null,
      senderRole: "SYSTEM",
      body: "Application submitted. Alta may reply through your Secure Deal Room if additional information is required.",
      attachments: null,
    },
    {
      senderUserId: staffId,
      senderRole: "ALTA_STAFF",
      body: "Hi Carter — thanks for submitting. I've pulled up your file. Could you share your most recent two months of bank statements and a quick note on intended use of funds?",
      attachments: null,
    },
    {
      senderUserId: carterId,
      senderRole: "APPLICANT",
      body: "Sure — attaching the statements now. Funds will go toward inventory restock ahead of Q4.",
      attachments: [
        { type: "FILE", fileName: "September-Statement.pdf", url: "https://example.com/sept.pdf", mimeType: "application/pdf", fileSizeBytes: 482000 },
        { type: "FILE", fileName: "October-Statement.pdf", url: "https://example.com/oct.pdf", mimeType: "application/pdf", fileSizeBytes: 511200 },
      ],
    },
    {
      senderUserId: carterId,
      senderRole: "APPLICANT",
      body: "And here's a photo of the warehouse — the new shelving is going up next week.",
      attachments: [
        { type: "IMAGE", fileName: "warehouse.jpg", url: "https://images.unsplash.com/photo-1553413077-190dd305871c?w=800", mimeType: "image/jpeg" },
      ],
    },
    {
      senderUserId: staffId,
      senderRole: "ALTA_STAFF",
      body: "Perfect, received. For reference here's our rate sheet so you can see how the pricing tiers work: https://alta.bank/rates\n\nWe'll have a decision back within 1 business day.",
      attachments: [
        { type: "LINK", fileName: "Alta Rate Sheet", url: "https://alta.bank/rates" },
      ],
    },
    {
      senderUserId: null,
      senderRole: "SYSTEM",
      body: "Status updated to Waiting on Alta.",
      attachments: null,
    },
  ];

  if (existing < 3) {
    for (const m of seedMessages) {
      await db.loanApplicationThreadMessage.create({ data: { threadId, ...m } });
    }
    console.log("seeded", seedMessages.length, "messages");
  } else {
    console.log("already has messages; skipping seed");
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
