"use client";

/**
 * Thin route-compatible wrapper — prefer AltaCardApplyWorkflow for new surfaces.
 * Kept so existing imports (tests, internal links) continue to work.
 */
import { AltaCardApplyWorkflow } from "@/components/bank/alta-card/alta-card-apply-workflow";

type ApplyContext = Awaited<
  ReturnType<typeof import("@/lib/bank/alta-card.functions").fetchAltaCardApplyContext>
>;

export function AltaCardApplyForm({
  context,
  kind,
  defaultCompanyId,
}: {
  context: ApplyContext;
  kind: "personal" | "business";
  defaultCompanyId?: string;
}) {
  return (
    <AltaCardApplyWorkflow
      open
      context={context}
      kind={kind}
      defaultCompanyId={defaultCompanyId}
      onOpenChange={() => {
        /* Embedded page form — dismiss handled by parent route when used via workflow. */
      }}
    />
  );
}
