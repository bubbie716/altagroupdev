import { PageShell } from "@/components/page-shell";
import { InternalSubNav } from "./internal-sub-nav";
import { InternalGlobalSearch } from "./internal-global-search";
import { InternalNotificationsBell } from "./internal-notifications-bell";
import type { ReactNode } from "react";

export function InternalPageShell({
  title,
  description,
  children,
  hideSearch,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  hideSearch?: boolean;
}) {
  return (
    <PageShell
      eyebrow="Alta Internal"
      title={title}
      description={description}
      hideFooter
    >
      <InternalSubNav />
      <InternalNotificationsBell />
      {!hideSearch ? <InternalGlobalSearch /> : null}
      {children}
    </PageShell>
  );
}
