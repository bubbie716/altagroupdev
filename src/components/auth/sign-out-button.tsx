"use client";

import type { ReactNode } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { logoutUser } from "@/lib/auth/auth.functions";

export function SignOutButton({
  className,
  children = "Sign out →",
}: {
  className?: string;
  children?: ReactNode;
}) {
  const router = useRouter();
  const logout = useServerFn(logoutUser);

  async function handleLogout() {
    await logout();
    await router.invalidate();
    await router.navigate({ to: "/login" });
  }

  return (
    <button type="button" onClick={() => void handleLogout()} className={className}>
      {children}
    </button>
  );
}
