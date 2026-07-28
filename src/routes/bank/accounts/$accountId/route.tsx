import { createFileRoute, Outlet } from "@tanstack/react-router";

/**
 * Compatibility layout for /bank/accounts/$accountId/*.
 * Do not redirect here — a parent redirect would drop child paths like
 * /activity and /scheduled. Each child route redirects to the canonical
 * /bank/account/$accountId/* destination (and preserves search where needed).
 */
export const Route = createFileRoute("/bank/accounts/$accountId")({
  component: () => <Outlet />,
});
