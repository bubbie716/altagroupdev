import { useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { type } from "@/lib/typography";
import { RouteButton } from "@/components/bank/route-button";
import { BankSubNavScroll, bankSubNavClass } from "@/components/bank/bank-scroll-contain";
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
  invoices: "Invoices",
  payroll: "Payroll",
  statements: "Statements",
  representatives: "Representatives",
  settings: "Settings",
};

const MODULE_PATHS: Record<BusinessAccountModule, string> = {
  overview: "",
  activity: "/activity",
  payments: "/payments",
  invoices: "/invoices",
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
    <BankSubNavScroll>
      <nav className={bankSubNavClass}>
      {visibleModules.map((mod) => {
        const to = `${base}${MODULE_PATHS[mod]}` as
          | "/bank/account/$accountId"
          | "/bank/account/$accountId/activity"
          | "/bank/account/$accountId/payments"
          | "/bank/account/$accountId/invoices"
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
          <RouteButton
            key={mod}
            to={to}
            params={{ accountId }}
            className={cn(
              "type-subnav rounded-md px-3 py-1.5 transition-colors",
              active
                ? "bg-surface-2 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {MODULE_LABELS[mod]}
          </RouteButton>
        );
      })}
      </nav>
    </BankSubNavScroll>
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
    <BankSubNavScroll>
      <nav className={bankSubNavClass}>
      {links.map((l) => {
        const path = `${base}${l.suffix}`;
        const active =
          l.suffix === ""
            ? pathname === base || pathname === `${base}/`
            : pathname.startsWith(path);
        return (
          <RouteButton
            key={l.suffix}
            to={
              (l.suffix === ""
                ? "/bank/account/$accountId"
                : `/bank/account/$accountId${l.suffix}`) as string
            }
            params={{ accountId }}
            className={cn(
              "type-subnav rounded-md px-3 py-1.5 transition-colors",
              active
                ? "bg-surface-2 text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {l.label}
          </RouteButton>
        );
      })}
      </nav>
    </BankSubNavScroll>
  );
}
