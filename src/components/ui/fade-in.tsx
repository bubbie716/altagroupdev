import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type FadeInProps = {
  children: ReactNode;
  className?: string;
  /** Seconds — staggered entrances on list items. */
  delay?: number;
};

/** CSS fade/slide — respects prefers-reduced-motion via .animate-fade-in-up. */
export function FadeIn({ children, className, delay = 0 }: FadeInProps) {
  return (
    <div
      className={cn("animate-fade-in-up", className)}
      style={delay > 0 ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
