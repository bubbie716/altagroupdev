"use client";

import { Link, useRouter } from "@tanstack/react-router";
import { LayoutDashboard, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/hooks/use-current-user";
import { logoutUser } from "@/lib/auth/auth.functions";
import { invalidateRootSessionCache } from "@/lib/auth/root-session-cache";
import { useServerFn } from "@tanstack/react-start";
import { cn } from "@/lib/utils";

const menuContentClass =
  "w-52 rounded-sm border border-[#e5e7eb] bg-white p-1 text-[#374151] shadow-sm";
const menuItemClass =
  "cursor-pointer rounded-sm px-2.5 py-2 text-[13px] text-[#374151] outline-none focus:bg-[#f9fafb] data-[highlighted]:bg-[#f9fafb] data-[highlighted]:text-[#111827]";
const menuLabelClass = "px-2.5 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[#6b7280]";
const menuSeparatorClass = "-mx-1 my-1 h-px bg-[#e5e7eb]";

export function NccUserMenu() {
  const user = useCurrentUser();
  const router = useRouter();
  const logout = useServerFn(logoutUser);

  if (!user) return null;

  const initials = user.discordUsername.slice(0, 2).toUpperCase();

  async function handleLogout() {
    await logout();
    invalidateRootSessionCache();
    await router.invalidate();
    await router.navigate({ to: "/login" });
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-2 rounded-sm border border-[#e5e7eb] bg-white py-1 pl-3 pr-1",
          "text-[13px] font-medium text-[#374151] outline-none transition-colors",
          "hover:bg-[#f9fafb] focus-visible:shadow-none focus-visible:ring-0",
          "data-[state=open]:border-[#0c4d32]/30 data-[state=open]:bg-[#e8f2ed]",
        )}
      >
        Account
        <Avatar className="size-7 border border-[#e5e7eb]">
          {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.discordUsername} /> : null}
          <AvatarFallback className="bg-[#e8f2ed] text-[10px] font-medium text-[#0c4d32]">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={menuContentClass}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DropdownMenuLabel className={menuLabelClass}>
          <div className="truncate normal-case tracking-normal text-[13px] font-semibold text-[#111827]">
            {user.discordUsername}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className={menuSeparatorClass} />
        <DropdownMenuItem asChild className={menuItemClass}>
          <Link to="/portal" className="flex w-full items-center outline-none focus-visible:shadow-none">
            <LayoutDashboard className="mr-2 size-3.5 text-[#6b7280]" />
            Institution portal
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className={menuItemClass}>
          <Link to="/admin" className="flex w-full items-center outline-none focus-visible:shadow-none">
            <LayoutDashboard className="mr-2 size-3.5 text-[#6b7280]" />
            Admin panel
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className={menuSeparatorClass} />
        <DropdownMenuItem
          onClick={handleLogout}
          className={cn(
            menuItemClass,
            "text-[#b91c1c] focus:text-[#b91c1c] data-[highlighted]:bg-[#fef2f2] data-[highlighted]:text-[#b91c1c]",
          )}
        >
          <LogOut className="mr-2 size-3.5" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
