"use client";

import { useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, Menu, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { NccWordmark } from "@/components/ncc/ncc-logo";
import { NccUserMenu } from "@/components/ncc/ncc-user-menu";
import { PORTAL_NAV } from "@/lib/ncc/portal-types";
import type { PortalInstitutionSummary, PortalNotification } from "@/lib/ncc/portal-types";
import { PortalStatusBadge } from "@/components/ncc/portal/portal-status-badge";
import { PortalGlobalSearch } from "@/components/ncc/portal/portal-global-search";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function normalizePath(pathname: string): string {
  return pathname.replace(/\/$/, "") || "/";
}

function isNavActive(pathname: string, to: string, exact?: boolean): boolean {
  const path = normalizePath(pathname);
  const target = normalizePath(to);
  if (exact) return path === target;
  return path === target || path.startsWith(`${target}/`);
}

export function PortalShell({
  institution,
  notifications = [],
  children,
}: {
  institution: PortalInstitutionSummary;
  notifications?: PortalNotification[];
  children: React.ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const unread = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const nav = (
    <nav className="space-y-0.5" aria-label="Institution portal">
      {PORTAL_NAV.map((item) => {
        const active = isNavActive(pathname, item.to, "exact" in item ? item.exact : false);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "block rounded-sm px-3 py-2 text-[13px] font-medium transition-colors",
              active
                ? "bg-[#e8f2ed] text-[#0c4d32]"
                : "text-[#4b5563] hover:bg-[#f9fafb] hover:text-[#111827]",
            )}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="ncc-site flex min-h-screen bg-[#f9fafb] font-sans text-[#111827] antialiased">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-[#e5e7eb] bg-white lg:flex">
        <div className="border-b border-[#e5e7eb] px-4 py-4">
          <Link to="/portal" className="inline-flex">
            <NccWordmark />
          </Link>
          <div className="mt-4 space-y-1">
            <div className="truncate text-[12px] font-semibold text-[#111827]">
              {institution.displayName}
            </div>
            <PortalStatusBadge status={institution.status} kind="institution" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-3">{nav}</div>
        <div className="border-t border-[#e5e7eb] px-4 py-3 text-[10px] uppercase tracking-[0.12em] text-[#9ca3af]">
          Newport Clearing Corporation
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-[#e5e7eb] bg-white">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger
                className="inline-flex size-9 items-center justify-center rounded-sm border border-[#e5e7eb] lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="size-4" />
              </SheetTrigger>
              <SheetContent side="left" className="w-72 border-[#e5e7eb] bg-white p-0">
                <SheetHeader className="border-b border-[#e5e7eb] px-4 py-4 text-left">
                  <SheetTitle className="text-[14px] font-semibold">Institution Portal</SheetTitle>
                </SheetHeader>
                <div className="px-2 py-3">{nav}</div>
              </SheetContent>
            </Sheet>

            <div className="hidden min-w-0 flex-1 md:block">
              <PortalGlobalSearch />
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Link
                to="/portal"
                className="inline-flex size-9 items-center justify-center rounded-sm border border-[#e5e7eb] text-[#6b7280] md:hidden"
                aria-label="Search"
              >
                <Search className="size-4" />
              </Link>

              <DropdownMenu modal={false}>
                <DropdownMenuTrigger
                  className="relative inline-flex size-9 items-center justify-center rounded-sm border border-[#e5e7eb] text-[#6b7280] hover:bg-[#f9fafb]"
                  aria-label="Notifications"
                >
                  <Bell className="size-4" />
                  {unread > 0 ? (
                    <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[#b91c1c]" />
                  ) : null}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 rounded-sm border-[#e5e7eb] bg-white p-1">
                  <DropdownMenuLabel className="px-2.5 py-2 text-[11px] uppercase tracking-[0.12em] text-[#6b7280]">
                    Notifications
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-[#e5e7eb]" />
                  {notifications.length === 0 ? (
                    <div className="px-3 py-6 text-center text-[12px] text-[#6b7280]">
                      No notifications
                    </div>
                  ) : (
                    notifications.slice(0, 8).map((item) => (
                      <DropdownMenuItem key={item.id} asChild className="rounded-sm px-2.5 py-2">
                        <Link to={(item.href ?? "/portal") as "/portal"} className="block outline-none">
                          <div className="text-[12px] font-medium text-[#111827]">{item.title}</div>
                          <div className="mt-0.5 line-clamp-2 text-[11px] text-[#6b7280]">{item.body}</div>
                        </Link>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <NccUserMenu />
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

export function PortalPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-[#e5e7eb] pb-5">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#6b7280]">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#111827]">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-[13px] text-[#6b7280]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function PortalMetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-sm border border-[#e5e7eb] bg-white p-4 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#6b7280]">{label}</div>
      <div className="mt-2 text-[20px] font-semibold tabular-nums tracking-tight text-[#111827]">
        {value}
      </div>
      {hint ? <div className="mt-1 text-[11px] text-[#9ca3af]">{hint}</div> : null}
    </div>
  );
}
