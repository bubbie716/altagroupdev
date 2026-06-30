import { florin } from "@/lib/bank/api";

export function ScheduleRemainingDueCell({
  totalAmount,
  paidAmount,
  status,
}: {
  totalAmount: number;
  paidAmount: number;
  status: string;
}) {
  const remaining = Math.max(0, Math.round((totalAmount - paidAmount) * 100) / 100);

  if (status === "paid" || status === "waived" || remaining <= 0.005) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <div>
      <span className="type-finance font-medium">{florin(remaining)}</span>
      {paidAmount > 0.005 ? (
        <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
          {florin(paidAmount)} paid
        </span>
      ) : null}
    </div>
  );
}
