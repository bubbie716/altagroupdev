import { Prisma, type SettlementOutboxEvent } from "@prisma/client";
import { prisma } from "@/server/db";
import { NCC_OUTBOX_EVENTS } from "@/server/ncc/ncc-outbox.service";

type InstitutionRole = "sender" | "receiver";

function redactPayloadForRole(
  payload: Record<string, unknown>,
  role: InstitutionRole,
): Record<string, unknown> {
  const copy = { ...payload };
  // Never expose internal adapter references or encrypted full account numbers.
  delete copy.sourceAccountReference;
  delete copy.destinationAccountReference;
  delete copy.internalSourceAccountReference;
  delete copy.internalDestinationAccountReference;
  delete copy.sourceAccountNumberEncrypted;
  delete copy.destinationAccountNumberEncrypted;
  delete copy.sourceAccountNumber;
  delete copy.destinationAccountNumber;
  if (role === "receiver") {
    delete copy.sendingPrivateMetadata;
  }
  if (role === "sender") {
    delete copy.receivingPrivateMetadata;
  }
  return copy;
}

/**
 * Fan out a settlement outbox event into institution-specific webhook events + deliveries.
 * Idempotent on dedupeKey per institution/role.
 */
export async function fanOutOutboxEventToWebhooks(event: SettlementOutboxEvent): Promise<{
  eventsCreated: number;
  deliveriesCreated: number;
}> {
  if (!event.settlementInstructionId) return { eventsCreated: 0, deliveriesCreated: 0 };

  const instruction = await prisma.settlementInstruction.findUnique({
    where: { id: event.settlementInstructionId },
    include: {
      sendingInstitution: { select: { id: true, displayName: true, slug: true } },
      receivingInstitution: { select: { id: true, displayName: true, slug: true } },
      execution: true,
    },
  });
  if (!instruction) return { eventsCreated: 0, deliveriesCreated: 0 };

  const basePayload = {
    eventType: event.eventType,
    reference: instruction.publicReference,
    status: instruction.status,
    executionStatus: instruction.execution?.status ?? null,
    executionStep: instruction.execution?.currentStep ?? null,
    amount: instruction.amount.toString(),
    currency: instruction.currency,
    externalReference: instruction.externalReference,
    failureCode: instruction.failureCode ?? instruction.execution?.failureCode ?? null,
    failureReason: instruction.failureReason ?? instruction.execution?.failureReason ?? null,
    submittedAt: instruction.submittedAt?.toISOString() ?? null,
    nccPostedAt: instruction.settledAt?.toISOString() ?? null,
    completedAt: instruction.execution?.completedAt?.toISOString() ?? null,
    sendingInstitution: {
      id: instruction.sendingInstitution.id,
      displayName: instruction.sendingInstitution.displayName,
      slug: instruction.sendingInstitution.slug,
    },
    receivingInstitution: {
      id: instruction.receivingInstitution.id,
      displayName: instruction.receivingInstitution.displayName,
      slug: instruction.receivingInstitution.slug,
    },
    ...(typeof event.payload === "object" && event.payload && !Array.isArray(event.payload)
      ? (event.payload as Record<string, unknown>)
      : {}),
  };

  const targets: Array<{ institutionId: string; role: InstitutionRole }> = [
    { institutionId: instruction.sendingInstitutionId, role: "sender" },
    { institutionId: instruction.receivingInstitutionId, role: "receiver" },
  ];

  let eventsCreated = 0;
  let deliveriesCreated = 0;

  for (const target of targets) {
    const dedupeKey = `wh:${event.id}:${target.institutionId}:${target.role}`;
    let webhookEvent = await prisma.nccWebhookEvent.findUnique({ where: { dedupeKey } });
    if (!webhookEvent) {
      try {
        webhookEvent = await prisma.nccWebhookEvent.create({
          data: {
            institutionId: target.institutionId,
            eventType: event.eventType,
            environment: "LIVE",
            subjectType: "SETTLEMENT_INSTRUCTION",
            subjectReference: instruction.publicReference,
            payload: redactPayloadForRole(basePayload, target.role) as Prisma.InputJsonValue,
            occurredAt: event.createdAt,
            outboxEventId: event.id,
            dedupeKey,
          },
        });
        eventsCreated += 1;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          webhookEvent = await prisma.nccWebhookEvent.findUniqueOrThrow({ where: { dedupeKey } });
        } else {
          throw error;
        }
      }
    }

    const endpoints = await prisma.nccWebhookEndpoint.findMany({
      where: {
        institutionId: target.institutionId,
        status: "ACTIVE",
        environment: "LIVE",
        subscribedEvents: { has: event.eventType },
      },
    });

    for (const endpoint of endpoints) {
      try {
        await prisma.nccWebhookDelivery.create({
          data: {
            webhookEventId: webhookEvent.id,
            webhookEndpointId: endpoint.id,
            status: "PENDING",
            nextAttemptAt: new Date(),
          },
        });
        deliveriesCreated += 1;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          continue;
        }
        throw error;
      }
    }
  }

  return { eventsCreated, deliveriesCreated };
}

/** Register production outbox → webhook fanout for all settlement event types. */
export function registerSettlementWebhookOutboxHandlers(
  register: (eventType: string, handler: (event: SettlementOutboxEvent) => Promise<void>) => void,
): void {
  const handler = async (event: SettlementOutboxEvent) => {
    await fanOutOutboxEventToWebhooks(event);
  };
  for (const eventType of Object.values(NCC_OUTBOX_EVENTS)) {
    register(eventType, handler);
  }
}
