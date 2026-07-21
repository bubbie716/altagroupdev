import { createFileRoute, redirect } from "@tanstack/react-router";
import { RETIRED_EXCHANGE_TERMINAL_PATH } from "@/lib/site/exchange-retirement-redirect";

export const Route = createFileRoute("/exchange/api")({
  beforeLoad: () => {
    throw redirect({ to: RETIRED_EXCHANGE_TERMINAL_PATH });
  },
});
