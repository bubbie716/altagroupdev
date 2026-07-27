import type { ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

type SearchInput =
  | Record<string, unknown>
  | ((prev: Record<string, unknown>) => Record<string, unknown>);

type RouteButtonProps = {
  to: string;
  params?: Record<string, string>;
  search?: SearchInput;
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
  const currentSearch = useRouterState({
    select: (s) => s.location.search as Record<string, unknown>,
  });

  return (
    <button
      type={type}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn("cursor-pointer", className)}
      onClick={() => {
        const resolvedSearch =
          typeof search === "function" ? search(currentSearch ?? {}) : search;
        void navigate({ to, params, search: resolvedSearch });
      }}
    >
      {children}
    </button>
  );
}
