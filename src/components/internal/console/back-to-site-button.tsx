"use client";

import { ArrowLeft } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  getSiteReturnPath,
  parseSiteReturnPath,
} from "@/lib/navigation/site-return-path";

export function BackToSiteButton({ className }: { className?: string }) {
  const navigate = useNavigate();

  function handleClick() {
    const { to, search } = parseSiteReturnPath(getSiteReturnPath());
    void navigate({ to, search });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-sm border border-border/80 bg-surface-2/50 px-2.5 py-2 text-left text-[12px] font-medium text-foreground transition-colors hover:border-border-strong hover:bg-surface-2",
        className,
      )}
    >
      <ArrowLeft className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      Back to site
    </button>
  );
}
