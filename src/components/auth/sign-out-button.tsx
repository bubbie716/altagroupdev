"use client";

import type { ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { logoutUser } from "@/lib/auth/auth.functions";
import { invalidateRootSessionCache } from "@/lib/auth/root-session-cache";
import { useSiteContext } from "@/hooks/use-site-context";

export function SignOutButton({
  className,
  children = "Sign out →",
}: {
  className?: string;
  children?: ReactNode;
}) {
  const router = useRouter();
  const site = useSiteContext();
  const logout = useServerFn(logoutUser);

  async function handleLogout() {
    await logout();
    invalidateRootSessionCache();
    await router.invalidate();
    await router.navigate({ to: "/" });
  }

  return (
    <button type="button" onClick={() => void handleLogout()} className={className}>
      {children}
    </button>
  );
}
