import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function resolveDatabaseUrl(): string | undefined {
  let url = process.env.DATABASE_URL?.trim();
  if (!url) return undefined;

  url = url
    .replace(/([?&])channel_binding=require&?/g, "$1")
    .replace(/\?&/, "?")
    .replace(/[?&]$/, "");

  if (url.includes("connection_limit=")) return url;

  const joiner = url.includes("?") ? "&" : "?";
  return `${url}${joiner}connection_limit=5&pool_timeout=20&connect_timeout=30`;
}

const databaseUrl = resolveDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}
