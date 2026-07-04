/** Normalized audit source for failed / blocked operational actions. */
export type FailedActionSource = "WEB" | "INTERNAL" | "DISCORD_BOT" | "CRON" | "SYSTEM";

export function normalizeFailedActionSource(
  source?: string | null,
): FailedActionSource {
  const raw = (source ?? "INTERNAL").toLowerCase();
  if (raw === "website" || raw === "web") return "WEB";
  if (raw === "discord_bot" || raw === "discord") return "DISCORD_BOT";
  if (raw === "cron") return "CRON";
  if (raw === "system") return "SYSTEM";
  return "INTERNAL";
}
