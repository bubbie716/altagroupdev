import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { INTERNAL_NAV_GROUPS, isInternalNavActive } from "@/components/internal/console/internal-nav-config";

export function InternalSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="internal-sidebar flex h-full w-[13.5rem] shrink-0 flex-col border-r border-border/80 bg-surface-1/40">
      <div className="border-b border-border/60 px-3 py-2.5">
        <Link to="/internal" className="block font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
          Alta Internal
        </Link>
        <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground/70">
          Bank console
        </p>
      </div>

      <nav aria-label="Internal console" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
        {INTERNAL_NAV_GROUPS.map((group) => (
          <div key={group.id} className="mb-3 last:mb-0">
            <p className="px-2 pb-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground/60">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.links.map((link) => {
                const active = isInternalNavActive(pathname, link);
                return (
                  <li key={`${group.id}-${link.to}-${link.label}`}>
                    <Link
                      to={link.to}
                      className={cn(
                        "block rounded px-2 py-1.5 text-[12px] leading-snug transition-colors",
                        active
                          ? "bg-surface-2 font-medium text-foreground"
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
    </aside>
  );
}
