import { Prisma } from "@prisma/client";

/** True when V1 ops tables (OpsReviewFlag, OpsExceptionDisposition) are not migrated yet. */
export function isMissingOpsV1TableError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2021" || error.code === "P2022";
  }
  if (error instanceof Error) {
    return (
      error.message.includes("OpsReviewFlag") ||
      error.message.includes("OpsExceptionDisposition")
    );
  }
  return false;
}
