import { createServerFn } from "@tanstack/react-start";

/** Load authenticated user from persisted session (RPC-safe). */
export const fetchCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const { readCurrentUser } = await import("@/server/auth.service");
  return readCurrentUser();
});

/** True when the session user has internal access (admin or operator tag). */
export const verifyInternalAccess = createServerFn({ method: "GET" }).handler(async () => {
  const { readCurrentUser } = await import("@/server/auth.service");
  const { canAccessInternal } = await import("@/lib/auth/permissions");
  const user = await readCurrentUser();
  return user ? canAccessInternal(user) : false;
});

/** True when the session user has the private_client tag. */
export const verifyPrivateClientAccess = createServerFn({ method: "GET" }).handler(async () => {
  const { readCurrentUser } = await import("@/server/auth.service");
  const { isPrivateClient } = await import("@/lib/auth/permissions");
  const user = await readCurrentUser();
  return user ? isPrivateClient(user) : false;
});

/** True when the session user has developer access (tag or approved workflow). */
export const verifyDeveloperAccess = createServerFn({ method: "GET" }).handler(async () => {
  const { readCurrentUser } = await import("@/server/auth.service");
  const { isDeveloper } = await import("@/lib/auth/permissions");
  const user = await readCurrentUser();
  return user ? isDeveloper(user) : false;
});

/** True when the session user may access the issuer portal for the given ticker. */
export const verifyIssuerPortalAccess = createServerFn({ method: "GET" })
  .inputValidator((input: { ticker: string }) => input)
  .handler(async ({ data }) => {
    const { readCurrentUser } = await import("@/server/auth.service");
    const { canAccessIssuerPortal } = await import("@/lib/auth/permissions");
    const user = await readCurrentUser();
    return user ? canAccessIssuerPortal(user, { ticker: data.ticker }) : false;
  });

/** Destroy persisted session and clear cookie. */
export const logoutUser = createServerFn({ method: "POST" }).handler(async () => {
  const { logoutCurrentUser } = await import("@/server/auth.service");
  await logoutCurrentUser();
  return { ok: true as const };
});
