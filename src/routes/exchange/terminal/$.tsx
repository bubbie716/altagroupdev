import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/exchange/terminal/$")({
  beforeLoad: ({ location }) => {
    const suffix = location.pathname.replace(/^\/exchange\/terminal\/?/, "");
    const target = suffix ? `/terminal/${suffix}` : "/terminal";
    throw redirect({ to: target, search: location.search, replace: true });
  },
});
