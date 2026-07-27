import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { BusinessPayrollCenter } from "@/components/bank/business-payroll-center";
import { CommercialProUpgradePanel } from "@/components/bank/commercial/commercial-pro-upgrade-panel";
import { Card, Section } from "@/components/page-shell";
import { fetchBusinessAccountContextForModule } from "@/lib/bank/business-account.functions";
import {
  fetchPayrollEmployees,
  fetchPayrollRuns,
} from "@/lib/bank/business-banking.functions";
import type { BusinessTreasuryCompany } from "@/lib/bank/business-banking-types";
import type { PayrollEmployeeRow, PayrollRunRow } from "@/lib/bank/business-banking-types";
import { accountCommercialRoutes } from "@/lib/bank/account-commercial-path";
import type { AccountCommercialLayoutData } from "@/lib/bank/account-commercial-loader.functions";
import {
  canAccessCommercialPayroll,
  classifyCommercialPayrollPageAccess,
  DEFAULT_COMMERCIAL_PRO_MONTHLY_FEE,
  type CommercialPlanSettings,
} from "@/lib/bank/commercial-banking-types";
import { florin } from "@/lib/bank/api";
import { canAccessBusinessModule } from "@/lib/bank/business-account-access";
import { invalidateRouteData } from "@/lib/router/invalidate-route-data";

type PayrollLoaderData =
  | {
      mode: "active";
      employees: PayrollEmployeeRow[];
      runs: PayrollRunRow[];
      treasury: BusinessTreasuryCompany;
    }
  | {
      mode: "upgrade";
      companyId: string;
      monthlyFee: number;
      canPurchase: boolean;
    }
  | {
      mode: "forbidden";
      customerMessage: string;
    }
  | {
      mode: "error";
      customerMessage: string;
    };

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "UNKNOWN";
}

function isProGateMessage(message: string): boolean {
  return (
    message.includes("Payroll requires Alta Commercial Pro") ||
    message.includes("requires Alta Commercial Pro")
  );
}

function commercialLayoutFromContext(context: unknown): AccountCommercialLayoutData | null {
  if (!context || typeof context !== "object") return null;
  if (!("commercialLayout" in context)) return null;
  return (context as { commercialLayout?: AccountCommercialLayoutData }).commercialLayout ?? null;
}

export const Route = createFileRoute("/bank/account/$accountId/commercial/payroll")({
  loader: async ({ params, context }): Promise<PayrollLoaderData> => {
    const layout = commercialLayoutFromContext(context);
    const commercial = layout?.context ?? null;
    const layoutPlan: CommercialPlanSettings | null = commercial?.plan ?? null;

    try {
      const ctx = await fetchBusinessAccountContextForModule({
        data: { accountId: params.accountId, module: "payroll" },
      });
      const roleCanAccess = canAccessBusinessModule(ctx.role, "payroll");
      const plan = layoutPlan;
      const access = classifyCommercialPayrollPageAccess({
        roleCanAccessPayroll: roleCanAccess,
        plan,
      });

      if (access.mode === "forbidden") {
        return {
          mode: "forbidden",
          customerMessage:
            access.customerMessage ??
            "You do not have permission to view payroll for this business account.",
        };
      }

      if (access.mode === "upgrade" || !plan || !canAccessCommercialPayroll(plan)) {
        return {
          mode: "upgrade",
          companyId: ctx.companyId,
          monthlyFee: plan?.monthlyFee ?? DEFAULT_COMMERCIAL_PRO_MONTHLY_FEE,
          canPurchase: commercial?.canManage ?? ctx.treasury.permissions.canManage,
        };
      }

      const [employees, runs] = await Promise.all([
        fetchPayrollEmployees({ data: ctx.companyId }),
        fetchPayrollRuns({ data: ctx.companyId }),
      ]);
      return {
        mode: "active",
        employees,
        runs,
        treasury: ctx.treasury,
      };
    } catch (err) {
      const message = extractErrorMessage(err);
      if (isProGateMessage(message) && commercial?.companyId) {
        return {
          mode: "upgrade",
          companyId: commercial.companyId,
          monthlyFee: layoutPlan?.monthlyFee ?? DEFAULT_COMMERCIAL_PRO_MONTHLY_FEE,
          canPurchase: commercial.canManage,
        };
      }
      const access = classifyCommercialPayrollPageAccess({
        roleCanAccessPayroll: false,
        plan: layoutPlan,
        errorMessage: message,
      });
      if (access.mode === "forbidden") {
        return {
          mode: "forbidden",
          customerMessage:
            access.customerMessage ??
            "You do not have permission to view payroll for this business account.",
        };
      }
      return {
        mode: "error",
        customerMessage:
          access.customerMessage ??
          "Payroll could not be loaded right now. Refresh the page or try again in a few minutes.",
      };
    }
  },
  head: () => ({ meta: [{ title: "Payroll — Alta Commercial" }] }),
  component: AccountCommercialPayrollPage,
});

function AccountCommercialPayrollPage() {
  const { accountId } = Route.useParams();
  const data = Route.useLoaderData();
  const router = useRouter();

  if (data.mode === "forbidden" || data.mode === "error") {
    return (
      <Section title="Payroll">
        <Card className="!p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
            {data.mode === "forbidden" ? "Access restricted" : "Something went wrong"}
          </p>
          <h2 className="mt-3 text-xl font-medium tracking-tight">
            {data.mode === "forbidden" ? "Payroll is unavailable" : "Could not load payroll"}
          </h2>
          <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
            {data.customerMessage}
          </p>
          <Link
            to="/bank/account/$accountId/commercial"
            params={{ accountId }}
            className="mt-6 inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium transition-colors hover:bg-surface-2/60"
          >
            Back to Commercial
          </Link>
        </Card>
      </Section>
    );
  }

  if (data.mode === "upgrade") {
    return (
      <Section title="Payroll">
        <PayrollProPreview
          accountId={accountId}
          companyId={data.companyId}
          monthlyFee={data.monthlyFee}
          canPurchase={data.canPurchase}
          onUpgraded={() => {
            void invalidateRouteData(router);
          }}
        />
      </Section>
    );
  }

  return (
    <Section title="Payroll">
      <BusinessPayrollCenter
        company={data.treasury}
        employees={data.employees}
        runs={data.runs}
        accountId={accountId}
      />
    </Section>
  );
}

function PayrollProPreview({
  accountId,
  companyId,
  monthlyFee,
  canPurchase,
  onUpgraded,
}: {
  accountId: string;
  companyId: string;
  monthlyFee: number;
  canPurchase: boolean;
  onUpgraded: () => void;
}) {
  return (
    <Card className="!p-6 sm:!p-8">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-gold">
        Alta Commercial Pro
      </p>
      <h2 className="mt-3 text-xl font-medium tracking-tight sm:text-2xl">
        Pay your team from your Business Operating Account
      </h2>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">
        Payroll lets you register employees, set pay schedules, and run salary batches that settle
        automatically at 9:00 AM Eastern on the chosen pay day. Employee records stay on Core after
        a downgrade; scheduled runs pause until Pro is active again.
      </p>

      <ul className="mt-6 grid gap-3 text-[13px] text-muted-foreground sm:grid-cols-2">
        {[
          "Employee registry with Alta deposit accounts",
          "Weekly, biweekly, monthly, or quarterly schedules",
          "Automatic execution on the chosen pay day",
          "Payroll history with per-employee line items",
        ].map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gold" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4 border-t border-border pt-6">
        <div>
          <p className="text-xs text-muted-foreground">Requires Alta Commercial Pro</p>
          <p className="mt-1 text-lg font-medium tabular-nums">
            {florin(monthlyFee)}
            <span className="text-sm font-normal text-muted-foreground"> / month</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/bank/account/$accountId/commercial"
            params={{ accountId }}
            className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium transition-colors hover:bg-surface-2/60"
          >
            Back to Commercial
          </Link>
          {canPurchase ? (
            <CommercialProUpgradePanel companyId={companyId} onCompleted={onUpgraded}>
              {({ open, loading }) => (
                <button
                  type="button"
                  disabled={loading}
                  onClick={open}
                  className="inline-flex min-h-11 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background disabled:opacity-50"
                >
                  Upgrade to Pro
                </button>
              )}
            </CommercialProUpgradePanel>
          ) : (
            <Link
              to={accountCommercialRoutes.settings}
              params={{ accountId }}
              className="inline-flex min-h-11 items-center rounded-md bg-foreground px-4 text-sm font-medium text-background"
            >
              View plan settings
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
