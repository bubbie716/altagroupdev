/** Maximum persisted snapshots per profile (personal or company). */
export const RELATIONSHIP_SNAPSHOT_RETENTION_COUNT = 52;

export type SnapshotMaterialChangeInput = {
  oldScore: number | null;
  newScore: number;
  oldTier: string | null;
  newTier: string;
  oldTotalAssets: number | null;
  newTotalAssets: number;
  oldCreditExposure: number | null;
  newCreditExposure: number;
  oldPrivateEligible?: boolean | null;
  newPrivateEligible?: boolean;
  oldCommercialEligible?: boolean | null;
  newCommercialEligible?: boolean;
};

const ASSET_CHANGE_THRESHOLD = 1_000;
const EXPOSURE_CHANGE_THRESHOLD = 500;

export function shouldWriteRelationshipSnapshot(input: SnapshotMaterialChangeInput): boolean {
  if (input.oldScore == null) return true;
  if (input.oldScore !== input.newScore) return true;
  if (input.oldTier !== input.newTier) return true;
  if (
    input.oldTotalAssets != null &&
    Math.abs(input.newTotalAssets - input.oldTotalAssets) >= ASSET_CHANGE_THRESHOLD
  ) {
    return true;
  }
  if (
    input.oldCreditExposure != null &&
    Math.abs(input.newCreditExposure - input.oldCreditExposure) >= EXPOSURE_CHANGE_THRESHOLD
  ) {
    return true;
  }
  if (
    input.oldPrivateEligible != null &&
    input.newPrivateEligible != null &&
    input.oldPrivateEligible !== input.newPrivateEligible
  ) {
    return true;
  }
  if (
    input.oldCommercialEligible != null &&
    input.newCommercialEligible != null &&
    input.oldCommercialEligible !== input.newCommercialEligible
  ) {
    return true;
  }
  return false;
}

export async function pruneRelationshipProfileSnapshots(
  prismaClient: {
    relationshipProfileSnapshot: {
      findMany: (args: {
        where: { userId: string };
        orderBy: { calculatedAt: "desc" };
        select: { id: true };
        skip: number;
      }) => Promise<Array<{ id: string }>>;
      deleteMany: (args: { where: { id: { in: string[] } } }) => Promise<unknown>;
    };
    companyRelationshipProfileSnapshot: {
      findMany: (args: {
        where: { companyId: string };
        orderBy: { calculatedAt: "desc" };
        select: { id: true };
        skip: number;
      }) => Promise<Array<{ id: string }>>;
      deleteMany: (args: { where: { id: { in: string[] } } }) => Promise<unknown>;
    };
  },
  scope: { userId: string } | { companyId: string },
): Promise<void> {
  if ("userId" in scope) {
    const stale = await prismaClient.relationshipProfileSnapshot.findMany({
      where: { userId: scope.userId },
      orderBy: { calculatedAt: "desc" },
      select: { id: true },
      skip: RELATIONSHIP_SNAPSHOT_RETENTION_COUNT,
    });
    if (stale.length > 0) {
      await prismaClient.relationshipProfileSnapshot.deleteMany({
        where: { id: { in: stale.map((row) => row.id) } },
      });
    }
    return;
  }

  const stale = await prismaClient.companyRelationshipProfileSnapshot.findMany({
    where: { companyId: scope.companyId },
    orderBy: { calculatedAt: "desc" },
    select: { id: true },
    skip: RELATIONSHIP_SNAPSHOT_RETENTION_COUNT,
  });
  if (stale.length > 0) {
    await prismaClient.companyRelationshipProfileSnapshot.deleteMany({
      where: { id: { in: stale.map((row) => row.id) } },
    });
  }
}
