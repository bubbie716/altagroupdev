import { Link, useRouter } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
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
import { useSiteContext } from "@/hooks/use-site-context";
import { useControlledMenu } from "@/hooks/use-controlled-menu";
import { resolveSiteSignInPath, buildSignInSearch } from "@/lib/site/site-sign-in-path";
import { canAccessAnyInternal } from "@/lib/auth/permissions";
import { logoutUser } from "@/lib/auth/auth.functions";
import { invalidateRootSessionCache } from "@/lib/auth/root-session-cache";
import { useServerFn } from "@tanstack/react-start";
import { getAccountMenuItems } from "@/lib/account/account-menu-config";
import { resolveSiteInternalLink } from "@/components/site/site-internal-link";
import { readRequestHost } from "@/lib/site/site-context";

export function AuthUserMenu() {
  const user = useCurrentUser();
  const site = useSiteContext();
  const router = useRouter();
  const logout = useServerFn(logoutUser);
  const menu = useControlledMenu();

  if (!user) {
    return (
      <Link
        to={resolveSiteSignInPath(site.key)}
        search={buildSignInSearch(site.key, site.defaultAuthenticatedRoute)}
        className="rounded-md border border-border-strong bg-surface-2 px-3.5 py-1.5 text-[12px] font-medium tracking-wide text-foreground transition-colors hover:bg-[var(--menu-item-hover)]"
      >
        Sign in
      </Link>
    );
  }

  const initials = user.discordUsername.slice(0, 2).toUpperCase();
  const showInternal = canAccessAnyInternal(user);
  const menuItems = getAccountMenuItems(site.key, { showInternal });

  async function handleLogout() {
    menu.close();
    await logout();
    invalidateRootSessionCache();
    await router.invalidate();
    await router.navigate({ to: resolveSiteSignInPath(site.key) });
  }

  function navigateToAccountItem(to: string) {
    if (menu.isNavigating()) return;
    const target = resolveSiteInternalLink(site.key, to, { host: readRequestHost() });
    menu.runAfterClose(() => {
      if (target.kind === "url") {
        window.location.assign(target.href);
        return;
      }
      void router.navigate({ to: target.to, search: target.search });
    });
  }

  return (
    <DropdownMenu modal={false} open={menu.open} onOpenChange={menu.setOpen}>
      <DropdownMenuTrigger
        className="flex items-center gap-2 rounded-md border border-border bg-surface-2/60 py-1 pl-3 pr-1 text-[12px] font-medium tracking-wide text-foreground outline-none transition-colors hover:border-border-strong hover:bg-surface-2 focus-visible:shadow-none focus-visible:ring-0 data-[state=open]:border-border-strong data-[state=open]:bg-surface-2"
      >
        Account
        <Avatar className="size-7 border border-border/60">
          {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.discordUsername} /> : null}
          <AvatarFallback className="bg-surface-2 text-[10px] font-medium">{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-52 bg-[var(--menu-surface)]"
        onCloseAutoFocus={(event) => {
          if (menu.isNavigating()) event.preventDefault();
        }}
      >
        <DropdownMenuLabel className="font-normal">
          <div className="truncate text-sm font-medium">{user.discordUsername}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem
              key={item.to}
              className="cursor-pointer"
              onSelect={() => {
                navigateToAccountItem(item.to);
              }}
            >
              <Icon className="mr-2 size-3.5" />
              {item.label}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            void handleLogout();
          }}
          className="cursor-pointer text-destructive focus:text-destructive data-[highlighted]:bg-[var(--menu-item-destructive-hover)] data-[highlighted]:text-destructive"
        >
          <LogOut className="mr-2 size-3.5" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
