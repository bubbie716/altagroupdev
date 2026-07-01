import { createFileRoute } from "@tanstack/react-router";
import { ExchangeRouteLayout } from "@/components/exchange/exchange-page-layout";

export const Route = createFileRoute("/exchange")({
  component: ExchangeRouteLayout,
});
