import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  BUSINESS_ACCOUNT_MODULES,
  canAccessBusinessModule,
  type BusinessAccountModule,
} from "@/lib/bank/business-account-access";
import type { CompanyRole } from "@/lib/auth/types";

const MODULE_LABELS: Record<BusinessAccountModule, string> = {
  overview: "Overview",
  activity: "Activity",
  payments: "Payments",
  payroll: "Payroll",
  statements: "Statements",
  representatives: "Representatives",
  settings: "Settings",
};

const MODULE_PATHS: Record<BusinessAccountModule, string> = {
  overview: "",
  activity: "/activity",
  payments: "/payments",
  payroll: "/payroll",
  statements: "/statements",
  representatives: "/representatives",
  settings: "/settings",
};

export function BusinessAccountSubNav({
  accountId,
  role,
}: {
  accountId: string;
  role: CompanyRole;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const base = `/bank/account/${accountId}`;

  const visibleModules = BUSINESS_ACCOUNT_MODULES.filter((mod) =>
    canAccessBusinessModule(role, mod),
  );

  return (
    <nav className="mb-8 flex flex-wrap gap-1 border-b border-border/60 pb-4">
      {visibleModules.map((mod) => {
        const to = `${base}${MODULE_PATHS[mod]}` as
          | "/bank/account/$accountId"
          | "/bank/account/$accountId/activity"
          | "/bank/account/$accountId/payments"
          | "/bank/account/$accountId/payroll"
          | "/bank/account/$accountId/statements"
          | "/bank/account/$accountId/representatives"
          | "/bank/account/$accountId/settings";
        const path = mod === "overview" ? base : `${base}${MODULE_PATHS[mod]}`;
        const active =
          mod === "overview"
            ? pathname === base || pathname === `${base}/`
            : pathname.startsWith(path);

        return (
          <Link
            key={mod}
            to={to}
            params={{ accountId }}
            className={cn(
              "rounded-md px-3 py-1.5 text-[12px] tracking-wide transition-colors",
              active
                ? "bg-surface-2 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {MODULE_LABELS[mod]}
          </Link>
        );
      })}
    </nav>
  );
}

export function PersonalAccountSubNav({ accountId }: { accountId: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const base = `/bank/account/${accountId}`;

  const links = [
    { suffix: "", label: "Overview", mod: "overview" },
    { suffix: "/activity", label: "Activity", mod: "activity" },
    { suffix: "/statements", label: "Statements", mod: "statements" },
    { suffix: "/settings", label: "Settings", mod: "settings" },
  ] as const;

  return (
    <nav className="mb-8 flex flex-wrap gap-1 border-b border-border/60 pb-4">
      {links.map((l) => {
        const path = `${base}${l.suffix}`;
        const active =
          l.suffix === ""
            ? pathname === base || pathname === `${base}/`
            : pathname.startsWith(path);
        return (
          <Link
            key={l.suffix}
            to={
              (l.suffix === ""
                ? "/bank/account/$accountId"
                : `/bank/account/$accountId${l.suffix}`) as
                | "/bank/account/$accountId"
                | "/bank/account/$accountId/activity"
                | "/bank/account/$accountId/statements"
                | "/bank/account/$accountId/settings"
            }
            params={{ accountId }}
            className={cn(
              "rounded-md px-3 py-1.5 text-[12px] tracking-wide transition-colors",
              active
                ? "bg-surface-2 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
