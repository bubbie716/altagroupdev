import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export type CheckboxProps = Omit<React.ComponentPropsWithoutRef<"input">, "type">;

/**
 * Custom-styled checkbox. Uses appearance-none so Safari does not render
 * the OS-default control (native size/border utilities alone are ignored there).
 */
const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, ref) => (
    <span className="relative mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center">
      <input
        type="checkbox"
        ref={ref}
        className={cn(
          "peer h-5 w-5 cursor-pointer appearance-none rounded-[4px] border border-border bg-transparent transition-colors",
          "checked:border-foreground checked:bg-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
      <Check
        aria-hidden
        strokeWidth={3}
        className="pointer-events-none absolute h-3.5 w-3.5 text-white opacity-0 transition-opacity peer-checked:opacity-100"
      />
    </span>
  ),
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
