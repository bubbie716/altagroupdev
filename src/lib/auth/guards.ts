import { redirect } from "@tanstack/react-router";
import type { AltaUser } from "@/lib/auth/types";
import {
  verifyDeveloperAccess,
  verifyInternalAccess,
  verifyIssuerPortalAccess,
  verifyPrivateClientAccess,
} from "@/lib/auth/auth.functions";

type GuardContext = {
  context: { user: AltaUser | null };
  location: { href: string; pathname: string };
};

export function authBeforeLoad({ context, location }: GuardContext) {
  if (context.user) return;
  throw redirect({
    to: "/login",
    search: { redirect: location.pathname },
  });
}

async function requireSignedIn({ context, location }: GuardContext) {
  if (!context.user) {
    throw redirect({
      to: "/login",
      search: { redirect: location.pathname },
    });
  }
}

async function requireAccess(
  context: GuardContext,
  verify: () => Promise<boolean>,
): Promise<void> {
  await requireSignedIn(context);
  const allowed = await verify();
  if (!allowed) {
    throw redirect({ to: "/access-restricted" });
  }
}

export async function internalBeforeLoad(context: GuardContext) {
  await requireAccess(context, verifyInternalAccess);
}

export async function privateClientBeforeLoad(context: GuardContext) {
  await requireAccess(context, verifyPrivateClientAccess);
}

export async function developerBeforeLoad(context: GuardContext) {
  await requireAccess(context, verifyDeveloperAccess);
}

type IssuerGuardContext = GuardContext & {
  params: { ticker: string };
};

export async function issuerPortalBeforeLoad(context: IssuerGuardContext) {
  await requireSignedIn(context);
  const allowed = await verifyIssuerPortalAccess({ data: { ticker: context.params.ticker } });
  if (!allowed) {
    throw redirect({ to: "/access-restricted" });
  }
}
