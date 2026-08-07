import { createFileRoute, Link } from "@tanstack/react-router";
import { AccountingShell } from "@/components/accounting/accounting-shell";
import { accountingBeforeLoad } from "@/lib/auth/guards";
import { fetchAccountingWorkspace } from "@/lib/accounting/accounting.functions";

function AccountingNotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">404</p>
      <h1 className="mt-3 text-[1.5rem] font-semibold tracking-tight">Page not found</h1>
      <Link
        to="/accounting"
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-[13px] font-medium text-background"
      >
        Return to Accounting
      </Link>
    </div>
  );
}

export const Route = createFileRoute("/accounting")({
  beforeLoad: accountingBeforeLoad,
  loader: async () => {
    const workspace = await fetchAccountingWorkspace();
    return { workspace };
  },
  staleTime: 30_000,
  component: AccountingLayout,
  notFoundComponent: AccountingNotFound,
  head: () => ({
    meta: [
      { title: "Alta Accounting" },
      { name: "robots", content: "noindex, nofollow" },
      {
        name: "description",
        content: "Private cash-basis accounting for Alta Group corporate administrators.",
      },
    ],
  }),
});

function AccountingLayout() {
  const { workspace } = Route.useLoaderData();
  return <AccountingShell initialWorkspace={workspace} />;
}
