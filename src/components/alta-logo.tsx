import { cn } from "@/lib/utils";

interface AltaLogoProps {
  className?: string;
  variant?: "default" | "gold" | "white";
}

/**
 * Alta mark — stylised "A": triangular outline with an arc base.
 * Pure SVG, inherits currentColor.
 */
export function AltaLogo({ className, variant = "default" }: AltaLogoProps) {
  const color =
    variant === "gold"
      ? "text-[var(--gold)]"
      : variant === "white"
        ? "text-white"
        : "text-foreground";
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-6 w-6", color, className)}
      aria-hidden="true"
    >
      {/* outer A */}
      <path
        d="M50 14 L84 84"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <path
        d="M50 14 L16 84"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
      />
      {/* curved base */}
      <path
        d="M20 80 Q50 60 80 80"
        stroke="currentColor"
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function AltaWordmark({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <AltaLogo className="h-7 w-7" />
      <span className="text-[15px] font-semibold tracking-[0.18em] text-foreground">
        ALTA
      </span>
    </div>
  );
}