import type { AltaPrivateClientContext } from "@/lib/bank/alta-private-client.types";
import { DEFAULT_ALTA_PRIVATE_BANKER } from "@/lib/bank/alta-private-banker.config";

/** Benefits supported today — understated, no promises beyond existing product behavior. */
export const ALTA_PRIVATE_MEMBER_BENEFITS = [
  "Relationship pricing",
  "Priority review",
  "Higher transfer limits",
  "Gold Card eligibility",
  "Dedicated banker",
  "Private lending",
] as const;

export function formatPrivateClientDisplayName(discordUsername: string): string {
  const base = discordUsername.split("#")[0]?.trim() || discordUsername.trim();
  const word = base.split(/[\s._-]/)[0] ?? base;
  if (!word) return "Client";
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function formatTimeOfDayGreeting(displayName: string, now = new Date()): string {
  const hour = now.getHours();
  const salutation = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return `${salutation}, ${displayName}.`;
}

export function formatWelcomeBackGreeting(displayName: string): string {
  return `Welcome back, ${displayName}.`;
}

export function formatMemberSinceLabel(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function buildAltaPrivateClientContext(input: {
  isMember: boolean;
  discordUsername: string;
  memberSince: string | null;
  relationshipTierLabel: string | null;
  now?: Date;
}): AltaPrivateClientContext {
  const displayName = formatPrivateClientDisplayName(input.discordUsername);
  if (!input.isMember) {
    return {
      isMember: false,
      displayName,
      greeting: "",
      welcomeBackGreeting: "",
      memberSince: null,
      memberSinceLabel: null,
      banker: null,
      relationshipTierLabel: null,
      benefits: [],
    };
  }

  return {
    isMember: true,
    displayName,
    greeting: formatTimeOfDayGreeting(displayName, input.now),
    welcomeBackGreeting: formatWelcomeBackGreeting(displayName),
    memberSince: input.memberSince,
    memberSinceLabel: formatMemberSinceLabel(input.memberSince),
    banker: DEFAULT_ALTA_PRIVATE_BANKER,
    relationshipTierLabel: input.relationshipTierLabel,
    benefits: ALTA_PRIVATE_MEMBER_BENEFITS,
  };
}
