import { createFileRoute, Link } from "@tanstack/react-router";
import { AccountingShell } from "@/components/accounting/accounting-shell";
import { accountingBeforeLoad } from "@/lib/auth/guards";
import { fetchAccountingWorkspace } from "@/lib/accounting/accounting.functions";

function AccountingNotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-sm text-gray-500">404</p>
      <h1 className="mt-3 text-xl font-semibold text-gray-800">Page not found</h1>
      <Link
        to="/accounting"
        className="mt-6 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Return to Dashboard
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
      { title: "Accounting Tracker" },
      { name: "robots", content: "noindex, nofollow" },
      {
        name: "description",
        content: "Simple cash-basis accounting in florins for corporate administrators.",
      },
    ],
  }),
});

function AccountingLayout() {
  const { workspace } = Route.useLoaderData();
  return <AccountingShell initialWorkspace={workspace} />;
}
