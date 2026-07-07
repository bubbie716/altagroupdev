import type { LucideIcon } from "lucide-react";
import { Building2, Shield, User } from "lucide-react";
import type { SiteKey } from "@/config/sites";
import { getSiteConfig } from "@/config/sites";

export type AccountMenuItem = {
  label: string;
  to: string;
  icon: LucideIcon;
};

export function getAccountMenuItems(
  siteKey: SiteKey,
  options: { showInternal: boolean },
): AccountMenuItem[] {
  const items: AccountMenuItem[] = [
    { label: "Profile", to: "/profile", icon: User },
    { label: "Companies", to: "/companies", icon: Building2 },
  ];

  if (options.showInternal && siteKey !== "ncc") {
    const site = getSiteConfig(siteKey);
    items.push({
      label: siteKey === "corporate" ? "Internal" : `${site.shortName} Internal`,
      to: "/internal",
      icon: Shield,
    });
  }

  return items;
}
