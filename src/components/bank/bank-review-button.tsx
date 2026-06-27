import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { invalidateRouteData } from "@/lib/router/invalidate-route-data";

function formatActionError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(/^BAD_REQUEST:/, "");
  }
  return "Action failed.";
}

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
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      await onAction();
      await invalidateRouteData(router);
    } catch (err) {
      setError(formatActionError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
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
      {error ? <span className="max-w-[220px] text-[10px] leading-snug text-destructive">{error}</span> : null}
    </span>
  );
}
