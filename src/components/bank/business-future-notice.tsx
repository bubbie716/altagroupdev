import { Info } from "lucide-react";
import { FUTURE_EXECUTION_NOTICE, INTERBANK_EXECUTION_NOTICE } from "@/lib/bank/business-banking-types";

export function BusinessFutureNotice({ variant = "default" }: { variant?: "default" | "interbank" }) {
  const message =
    variant === "interbank"
      ? INTERBANK_EXECUTION_NOTICE
      : `${FUTURE_EXECUTION_NOTICE} Submissions are reviewed by Alta before execution.`;

  return (
    <div className="mb-8 flex items-start gap-3 rounded-lg border border-gold/25 bg-gold/5 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
      <p>{message}</p>
    </div>
  );
}
