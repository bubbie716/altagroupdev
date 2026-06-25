import { PageShell } from "@/components/page-shell";
import { InternalSubNav } from "./internal-sub-nav";
import { InternalGlobalSearch } from "./internal-global-search";
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
      {!hideSearch ? <InternalGlobalSearch /> : null}
      {children}
    </PageShell>
  );
}
