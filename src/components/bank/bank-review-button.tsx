import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function BankReviewButton({
  label,
  variant = "default",
  onAction,
}: {
  label: string;
  variant?: "default" | "primary" | "danger";
  onAction: () => Promise<void>;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await onAction();
      await router.invalidate();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => void handleClick()}
      className={cn(
        "rounded border px-2 py-1 text-[11px] font-medium disabled:opacity-50",
        variant === "primary" && "border-gold/40 bg-gold/10 text-gold",
        variant === "danger" && "border-destructive/40 bg-destructive/5 text-destructive",
        variant === "default" && "border-border bg-surface-2 text-foreground",
      )}
    >
      {loading ? "…" : label}
    </button>
  );
}
