import { PageShell } from "@/components/page-shell";
import { InternalSubNav } from "./internal-sub-nav";
import type { ReactNode } from "react";

export function InternalPageShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <PageShell
      eyebrow="Alta Internal"
      title={title}
      description={description}
      hideFooter
    >
      <InternalSubNav />
      {children}
    </PageShell>
  );
}
