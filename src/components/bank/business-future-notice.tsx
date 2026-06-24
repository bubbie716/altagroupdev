import { Info } from "lucide-react";
import { FUTURE_EXECUTION_NOTICE, INTRABANK_EXECUTION_NOTICE } from "@/lib/bank/business-banking-types";

export function BusinessFutureNotice({ variant = "default" }: { variant?: "default" | "intrabank" }) {
  const message =
    variant === "intrabank"
      ? INTRABANK_EXECUTION_NOTICE
      : `${FUTURE_EXECUTION_NOTICE} All submissions enter manual review until execution is enabled.`;

  return (
    <div className="mb-8 flex items-start gap-3 rounded-lg border border-gold/25 bg-gold/5 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
      <p>{message}</p>
    </div>
  );
}
