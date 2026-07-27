import { createFileRoute, Link } from "@tanstack/react-router";
import { authBeforeLoad } from "@/lib/auth/guards";
import { BankRouteLayout } from "@/components/bank/bank-page-layout";

function BankNotFound() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">404</p>
      <h1 className="mt-3 text-[1.5rem] font-semibold tracking-tight text-foreground">
        This Bank page could not be found.
      </h1>
      <p className="mt-2 text-[14px] text-muted-foreground">
        The page may have moved, or the link is no longer valid.
      </p>
      <Link
        to="/bank"
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-foreground px-4 text-[13px] font-medium text-background hover:opacity-90"
      >
        Return to Bank
      </Link>
    </div>
  );
}

export const Route = createFileRoute("/bank")({
  beforeLoad: authBeforeLoad,
  staleTime: 60_000,
  component: BankRouteLayout,
  notFoundComponent: BankNotFound,
});
