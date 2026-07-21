import { createFileRoute, redirect } from "@tanstack/react-router";
import { RETIRED_EXCHANGE_TERMINAL_PATH } from "@/lib/site/exchange-retirement-redirect";

/** Legacy nested Terminal paths under /exchange — drop Exchange prefix entirely. */
export const Route = createFileRoute("/exchange/terminal/$")({
  beforeLoad: () => {
    throw redirect({ to: RETIRED_EXCHANGE_TERMINAL_PATH, replace: true });
  },
});
