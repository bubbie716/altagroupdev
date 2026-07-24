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
import { resolveSiteSignInPath, buildSignInSearch } from "@/lib/site/site-sign-in-path";
import { canAccessAnyInternal } from "@/lib/auth/permissions";
import { logoutUser } from "@/lib/auth/auth.functions";
import { invalidateRootSessionCache } from "@/lib/auth/root-session-cache";
import { useServerFn } from "@tanstack/react-start";
import { getAccountMenuItems } from "@/lib/account/account-menu-config";
import { SiteInternalLink } from "@/components/site/site-internal-link";

export function AuthUserMenu() {
  const user = useCurrentUser();
  const site = useSiteContext();
  const router = useRouter();
  const logout = useServerFn(logoutUser);

  if (!user) {
    return (
      <Link
        to={resolveSiteSignInPath()}
        search={buildSignInSearch(site.key, site.defaultAuthenticatedRoute)}
        className="rounded-md border border-border-strong bg-surface-2 px-3.5 py-1.5 text-[12px] font-medium tracking-wide text-foreground transition-colors hover:bg-[color:var(--surface-2)]/70"
      >
        Sign in
      </Link>
    );
  }

  const initials = user.discordUsername.slice(0, 2).toUpperCase();
  const showInternal = canAccessAnyInternal(user) && site.key !== "ncc";
  const menuItems = getAccountMenuItems(site.key, { showInternal });

  async function handleLogout() {
    await logout();
    invalidateRootSessionCache();
    await router.invalidate();
    await router.navigate({ to: resolveSiteSignInPath() });
  }

  return (
    <DropdownMenu modal={false}>
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
        className="w-52"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DropdownMenuLabel className="font-normal">
          <div className="truncate text-sm font-medium">{user.discordUsername}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <DropdownMenuItem key={item.to} asChild className="cursor-pointer">
              <SiteInternalLink
                siteKey={site.key}
                to={item.to}
                className="flex w-full cursor-pointer items-center outline-none focus-visible:shadow-none"
              >
                <Icon className="mr-2 size-3.5" />
                {item.label}
              </SiteInternalLink>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer text-destructive focus:text-destructive data-[highlighted]:text-destructive"
        >
          <LogOut className="mr-2 size-3.5" />
          Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
