import { createFileRoute } from "@tanstack/react-router";
import { BankRouteLayout } from "@/components/bank/bank-page-layout";

export const Route = createFileRoute("/bank")({
  component: BankRouteLayout,
});
