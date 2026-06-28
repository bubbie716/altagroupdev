import { Link } from "@tanstack/react-router";
import { CREDIT_DESK_INTERNAL_BANNER } from "@/lib/platform/credit-desk-copy";

export function CreditDeskBanner() {
  return (
    <div className="mb-6 rounded border-l-2 border-l-amber-400 border-y border-r border-amber-400/30 bg-amber-400/[0.06] px-5 py-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-200">
            <span className="size-1.5 animate-pulse rounded-full bg-amber-300" aria-hidden />
            {CREDIT_DESK_INTERNAL_BANNER.title}
          </div>
          <p className="mt-1.5 text-[13px] text-foreground">{CREDIT_DESK_INTERNAL_BANNER.body}</p>
        </div>
        <Link
          to="/internal/settings"
          className="rounded border border-amber-300/30 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-amber-100 hover:bg-amber-400/10"
        >
          Settings
        </Link>
      </div>
    </div>
  );
}
