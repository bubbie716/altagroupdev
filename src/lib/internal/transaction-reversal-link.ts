/** Standard metadata linking offsetting reversals to original transactions. */
export type LinkedReversalMetadata = {
  originalTransactionId: string;
  originalReferenceCode: string;
  reversalTransactionId?: string;
  reversalReferenceCode?: string;
  reversalReason: string;
  reversedByUserId: string;
  reversalKind: "adjustment" | "alta_pay" | "deposit" | "withdrawal" | "manual";
};

export function buildLinkedReversalMetadata(
  input: LinkedReversalMetadata,
): Record<string, string | null> {
  return {
    originalTransactionId: input.originalTransactionId,
    originalReferenceCode: input.originalReferenceCode,
    reversalTransactionId: input.reversalTransactionId ?? null,
    reversalReferenceCode: input.reversalReferenceCode ?? null,
    reversalReason: input.reversalReason,
    reversedByUserId: input.reversedByUserId,
    reversalKind: input.reversalKind,
  };
}

export function parseLinkedReversalMetadata(
  metadata: Record<string, unknown> | null | undefined,
): Partial<LinkedReversalMetadata> | null {
  if (!metadata || typeof metadata !== "object") return null;
  const originalTransactionId = metadata.originalTransactionId;
  const originalReferenceCode = metadata.originalReferenceCode;
  if (typeof originalTransactionId !== "string" || typeof originalReferenceCode !== "string") {
    return null;
  }
  return {
    originalTransactionId,
    originalReferenceCode,
    reversalTransactionId:
      typeof metadata.reversalTransactionId === "string" ? metadata.reversalTransactionId : undefined,
    reversalReferenceCode:
      typeof metadata.reversalReferenceCode === "string" ? metadata.reversalReferenceCode : undefined,
    reversalReason: typeof metadata.reversalReason === "string" ? metadata.reversalReason : "",
    reversedByUserId: typeof metadata.reversedByUserId === "string" ? metadata.reversedByUserId : "",
    reversalKind:
      metadata.reversalKind === "adjustment" ||
      metadata.reversalKind === "alta_pay" ||
      metadata.reversalKind === "deposit" ||
      metadata.reversalKind === "withdrawal" ||
      metadata.reversalKind === "manual"
        ? metadata.reversalKind
        : "manual",
  };
}
