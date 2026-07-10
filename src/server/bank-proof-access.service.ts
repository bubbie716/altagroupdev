import { resolveProofStorageKey } from "@/lib/storage/proof-upload.constants";
import { prisma } from "@/server/db";
import { requireOperator } from "@/server/permissions.service";

export type BankProofAccess = {
  storageKey: string;
  fileName: string;
  mimeType: string;
};

export async function getBankProofForDownload(
  actorUserId: string,
  transactionId: string,
): Promise<BankProofAccess> {
  const tx = await prisma.bankTransaction.findUnique({
    where: { id: transactionId },
    include: { bankAccount: true },
  });
  if (!tx) throw new Error("NOT_FOUND");
  if (!tx.proofImageUrl?.trim()) throw new Error("NOT_FOUND");

  const storageKey = resolveProofStorageKey(tx.proofImageUrl);
  if (!storageKey) throw new Error("NOT_FOUND");

  const isOwner = tx.bankAccount.userId === actorUserId;
  if (!isOwner) {
    try {
      await requireOperator();
    } catch {
      throw new Error("FORBIDDEN");
    }
  }

  return {
    storageKey,
    fileName: tx.proofFileName ?? "proof",
    mimeType: tx.proofMimeType ?? "application/octet-stream",
  };
}
