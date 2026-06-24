import { randomToken } from "@/server/crypto";
import { prisma } from "@/server/db";
import { mapDbUserToAltaUser, userWithMembershipsInclude } from "@/server/user-mapper";
import { sessionMaxAgeSec } from "@/server/session";
import type { AltaUser } from "@/lib/auth/types";

export async function createUserSession(userId: string): Promise<string | null> {
  const sessionToken = randomToken(32);
  const expiresAt = new Date(Date.now() + sessionMaxAgeSec() * 1000);

  await prisma.session.create({
    data: {
      userId,
      sessionToken,
      expiresAt,
    },
  });

  return sessionToken;
}

export async function loadUserBySessionToken(token: string): Promise<AltaUser | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const session = await prisma.session.findUnique({
        where: { sessionToken: token },
        include: {
          user: {
            include: userWithMembershipsInclude,
          },
        },
      });

      if (!session) return null;

      if (session.expiresAt.getTime() < Date.now()) {
        await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
        return null;
      }

      return mapDbUserToAltaUser(session.user);
    } catch (error) {
      const isTransient =
        error instanceof Error &&
        "code" in error &&
        (error as { code?: string }).code === "P1001" &&
        attempt === 0;

      if (isTransient) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        continue;
      }

      console.error("[session] Failed to load session", error);
      return null;
    }
  }

  return null;
}

export async function deleteSessionByToken(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { sessionToken: token } });
}

export async function authenticateAndCreateSession(user: AltaUser): Promise<string | null> {
  return createUserSession(user.id);
}
