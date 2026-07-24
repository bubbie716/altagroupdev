import type { AltaUser, UserTag } from "@/lib/auth/types";
import { canAccessInternal as userCanAccessInternal } from "@/lib/auth/permissions";

export function hasTag(user: AltaUser, tag: UserTag): boolean {
  return user.tags.includes(tag);
}

export function hasAnyTag(user: AltaUser, tags: UserTag[]): boolean {
  return tags.some((tag) => hasTag(user, tag));
}

export function hasAllTags(user: AltaUser, tags: UserTag[]): boolean {
  return tags.every((tag) => hasTag(user, tag));
}

export function canAccessInternal(user: AltaUser): boolean {
  return userCanAccessInternal(user);
}

export function formatCompanyRole(role: string): string {
  return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatAccountStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const USER_TAG_LABELS: Record<UserTag, string> = {
  corporate_admin: "Corporate Admin",
  bank_admin: "Bank Admin",
  terminal_admin: "Terminal Admin",
  private_client: "Private Client",
};

export function formatUserTag(tag: UserTag): string {
  return USER_TAG_LABELS[tag];
}
