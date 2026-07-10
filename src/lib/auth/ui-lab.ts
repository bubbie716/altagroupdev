/**
 * UI LAB ONLY — DO NOT ENABLE IN PRODUCTION
 *
 * Enabled by setting `VITE_UI_LAB_MODE=true`. When active, auth guards
 * are bypassed and a fixed mock user is injected so Lovable's UI Lab
 * can preview authenticated/protected pages without Discord OAuth,
 * database sessions, or real login flows.
 *
 * This file MUST be a no-op when the flag is unset. Never import or
 * use the mock user from production code paths.
 */
import type { AltaUser, EnrichedCompanyMembership } from "@/lib/auth/types";

export function isUiLabMode(): boolean {
  // Works on both client and server (Vite inlines import.meta.env).
  try {
    const enabled = import.meta.env?.VITE_UI_LAB_MODE === "true";
    if (enabled && import.meta.env?.PROD) {
      console.error(
        "[ui-lab] VITE_UI_LAB_MODE is set in a production build — auth bypass disabled.",
      );
      return false;
    }
    return enabled;
  } catch {
    return false;
  }
}

const MOCK_MEMBERSHIPS: EnrichedCompanyMembership[] = [
  {
    userId: "ui-lab-user",
    companyId: "CO-ALTG",
    role: "owner",
    companyName: "Alta Group N.V.",
    companyType: "Holding Company",
    companyTicker: "ALTG",
    companyStatus: "Listed",
    companyVerificationStatus: "Verified",
  },
  {
    userId: "ui-lab-user",
    companyId: "CO-NPC",
    role: "owner",
    companyName: "Newport Petroleum Corp.",
    companyType: "Listed Company",
    companyTicker: "NPC",
    companyStatus: "Listed",
    companyVerificationStatus: "Verified",
  },
];

/** UI LAB ONLY — DO NOT ENABLE IN PRODUCTION */
export const UI_LAB_MOCK_USER: AltaUser = {
  id: "ui-lab-user",
  discordId: "000000000000000000",
  discordUsername: "carter",
  avatarUrl: null,
  email: "carter.townshend@ui-lab.local",
  minecraftUsername: "carter",
  tags: ["admin", "operator", "private_client", "developer", "issuer"],
  accountStatus: "active",
  developerAccessStatus: "approved",
  developerAccess: true,
  internalAccess: true,
  companyMemberships: MOCK_MEMBERSHIPS,
  createdAt: new Date("2025-01-01T00:00:00.000Z").toISOString(),
  lastLoginAt: new Date("2025-01-01T00:00:00.000Z").toISOString(),
};

/** UI LAB ONLY — returns the mock user when the flag is on, else null. */
export function getUiLabUserIfEnabled(): AltaUser | null {
  return isUiLabMode() ? UI_LAB_MOCK_USER : null;
}
