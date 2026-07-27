import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

type RouteButtonProps = {
  to: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
  className?: string;
  children: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
  "aria-label"?: string;
};

/** In-app navigation without rendering an anchor/hyperlink. */
export function RouteButton({
  to,
  params,
  search,
  className,
  children,
  disabled,
  type = "button",
  "aria-label": ariaLabel,
}: RouteButtonProps) {
  const navigate = useNavigate();

  return (
    <button
      type={type}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn("cursor-pointer", className)}
      onClick={() => {
        void navigate({ to, params, search });
      }}
    >
      {children}
    </button>
  );
}
