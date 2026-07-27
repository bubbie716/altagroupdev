import { createServerFn } from "@tanstack/react-start";

/** Load authenticated user from persisted session (RPC-safe). */
export const fetchCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const { readCurrentUser } = await import("@/server/auth.service");
  return readCurrentUser();
});

/** True when the session user has any Alta staff tag. */
export const verifyInternalAccess = createServerFn({ method: "GET" }).handler(async () => {
  const { readCurrentUser } = await import("@/server/auth.service");
  const { canAccessAnyInternal } = await import("@/lib/auth/permissions");
  const user = await readCurrentUser();
  return user ? canAccessAnyInternal(user) : false;
});

/** Destroy persisted session and clear cookie. */
export const logoutUser = createServerFn({ method: "POST" }).handler(async () => {
  const { logoutCurrentUser } = await import("@/server/auth.service");
  await logoutCurrentUser();
  return { ok: true as const };
});
