import { Link, useRouterState } from "@tanstack/react-router";
import { AltaWordmark } from "./alta-logo";
import { AuthUserMenu } from "@/components/auth/user-menu";
import { cn } from "@/lib/utils";
import { type } from "@/lib/typography";
import { useTheme } from "./theme";
import { Sun, Moon, Menu } from "lucide-react";
import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const links = [
  { to: "/", label: "Home", exact: true },
  { to: "/bank", label: "Alta Bank", match: "/bank" },
  { to: "/exchange", label: "Alta Exchange", match: "/exchange" },
  { to: "/governance", label: "About", match: "/governance" },
] as const;

function isNavLinkActive(
  pathname: string,
  link: (typeof links)[number],
): boolean {
  if ("exact" in link && link.exact) return pathname === link.to;
  if ("match" in link) return pathname.startsWith(link.match);
  return pathname.startsWith(link.to);
}

export function SiteNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 sm:h-16 max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center">
          <AltaWordmark />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => {
            const active = isNavLinkActive(pathname, l);
            return (
              <Link
                key={l.to}
                to={l.to}
                className={cn(
                  "type-nav relative rounded-md px-3 py-1.5 text-muted-foreground transition-colors duration-200 hover:text-foreground",
                  active &&
                    "text-foreground after:absolute after:inset-x-2.5 after:-bottom-[17px] after:h-[2px] after:rounded-full after:bg-gold",
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="rounded-md border border-border bg-surface-2/60 p-2 text-muted-foreground transition-colors hover:text-foreground hover:border-border-strong"
          >
            {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
          </button>
          <div className="hidden md:block">
            <AuthUserMenu />
          </div>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                aria-label="Open menu"
                className="rounded-md border border-border bg-surface-2/60 p-2 text-muted-foreground transition-colors hover:text-foreground hover:border-border-strong md:hidden"
              >
                <Menu className="size-4" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] max-w-sm overflow-y-auto p-0">
              <SheetHeader className="border-b border-border/60 px-5 py-4 text-left">
                <SheetTitle>
                  <AltaWordmark />
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 p-4">
                {links.map((l) => {
                  const active = isNavLinkActive(pathname, l);
                  return (
                    <Link
                      key={l.to}
                      to={l.to}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        "rounded-md px-3 py-3 text-base font-medium transition-colors",
                        active
                          ? "bg-surface-2 text-foreground"
                          : "text-muted-foreground hover:bg-surface-2/60 hover:text-foreground",
                      )}
                    >
                      {l.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="border-t border-border/60 p-4">
                <AuthUserMenu />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

export { PublicFooter, SiteFooter } from "./footers";
