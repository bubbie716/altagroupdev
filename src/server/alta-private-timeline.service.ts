import {
  formatAltaPrivateInvitedCopy,
  formatPrivateBankingClientCopy,
} from "@/lib/bank/relationship-timeline-customer-copy";
import { prisma } from "@/server/db";
import {
  createRelationshipTimelineEvent,
  recordRelationshipTimelineEvent,
} from "@/server/relationship-timeline.service";

export async function recordAltaPrivateInvitedTimelineEvent(input: {
  userId: string;
  invitationId: string;
  occurredAt?: Date;
  actorUserId?: string;
}): Promise<void> {
  const copy = formatAltaPrivateInvitedCopy("personal");
  await recordRelationshipTimelineEvent({
    userId: input.userId,
    eventType: "ALTA_PRIVATE_INVITED",
    title: copy.title,
    description: copy.description,
    occurredAt: input.occurredAt ?? new Date(),
    relatedEntityType: "USER",
    relatedEntityId: input.invitationId,
    metadata: { invitationId: input.invitationId },
    dedupeKey: `private:invited:${input.invitationId}`,
    actorUserId: input.actorUserId,
  });
}

export async function recordAltaPrivateActivatedTimelineEvent(input: {
  userId: string;
  occurredAt?: Date;
  actorUserId?: string | null;
}): Promise<void> {
  const copy = formatPrivateBankingClientCopy("personal");
  const occurredAt = input.occurredAt ?? new Date();
  const row = await createRelationshipTimelineEvent({
    userId: input.userId,
    eventType: "PRIVATE_BANKING_CLIENT",
    title: copy.title,
    description: copy.description,
    occurredAt,
    relatedEntityType: "USER",
    relatedEntityId: input.userId,
    dedupeKey: "private:client",
    actorUserId: input.actorUserId ?? undefined,
  });
  if (!row) {
    await prisma.relationshipTimelineEvent.updateMany({
      where: {
        userId: input.userId,
        eventType: "PRIVATE_BANKING_CLIENT",
        metadata: { path: ["dedupeKey"], equals: "private:client" },
      },
      data: { occurredAt, title: copy.title, description: copy.description },
    });
  }
}

/** Timeline, private account activation, and relationship profile refresh after membership is granted. */
export async function ensurePrivateClientTimelineEventIfMissing(userId: string): Promise<void> {
  const [tag, event] = await Promise.all([
    prisma.userTagAssignment.findFirst({
      where: { userId, tag: "PRIVATE_CLIENT" },
      select: { createdAt: true },
    }),
    prisma.relationshipTimelineEvent.findFirst({
      where: {
        userId,
        eventType: "PRIVATE_BANKING_CLIENT",
        metadata: { path: ["dedupeKey"], equals: "private:client" },
      },
      select: { id: true },
    }),
  ]);
  if (!tag || event) return;
  await recordAltaPrivateActivatedTimelineEvent({
    userId,
    occurredAt: tag.createdAt,
  });
}

export async function finalizeAltaPrivateMembershipActivation(
  userId: string,
  actorUserId?: string | null,
): Promise<void> {
  await recordAltaPrivateActivatedTimelineEvent({ userId, actorUserId });

  const { activatePendingPrivateBankAccounts } = await import("@/server/bank.service");
  await activatePendingPrivateBankAccounts();

  const { refreshUserRelationshipProfileBestEffort } = await import(
    "@/server/relationship-refresh-hooks.service"
  );
  await refreshUserRelationshipProfileBestEffort(userId, "alta-private-activated");
}
