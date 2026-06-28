import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { INTERNAL_NAV_GROUPS, isInternalNavActive } from "@/components/internal/console/internal-nav-config";
import { BackToSiteButton } from "@/components/internal/console/back-to-site-button";

export function InternalSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="internal-sidebar flex h-full w-[13.5rem] shrink-0 flex-col border-r border-border/80 bg-surface-1/40">
      <div className="border-b border-border/60 px-3 py-3">
        <Link to="/internal" className="flex items-center gap-2">
          <span className="block h-3.5 w-px bg-gold" aria-hidden />
          <span className="font-serif text-[13px] tracking-tight text-foreground">Alta</span>
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-gold/80">Internal</span>
        </Link>
        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground/70">
          Operations console
        </p>
      </div>

      <nav aria-label="Internal console" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
        {INTERNAL_NAV_GROUPS.map((group) => (
          <div key={group.id} className="mb-3 last:mb-0">
            <p className="px-2 pb-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/60">
              {group.label}
            </p>
            <ul className="space-y-px">
              {group.links.map((link) => {
                const active = isInternalNavActive(pathname, link);
                return (
                  <li key={`${group.id}-${link.to}-${link.label}`}>
                    <Link
                      to={link.to}
                      className={cn(
                        "relative block rounded-sm px-2 py-1.5 pl-3 text-[12px] leading-snug transition-colors",
                        active
                          ? "bg-surface-2 font-medium text-foreground before:absolute before:inset-y-1 before:left-0 before:w-[2px] before:rounded-full before:bg-gold"
                          : "text-muted-foreground hover:bg-surface-2/60 hover:text-foreground",
                      )}
                    >
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-border/60 p-2">
        <BackToSiteButton />
      </div>
    </aside>
  );
}
