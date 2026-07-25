import { createFileRoute } from "@tanstack/react-router";
import { authBeforeLoad } from "@/lib/auth/guards";
import { BankRouteLayout } from "@/components/bank/bank-page-layout";

export const Route = createFileRoute("/bank")({
  beforeLoad: authBeforeLoad,
  staleTime: 60_000,
  component: BankRouteLayout,
});
