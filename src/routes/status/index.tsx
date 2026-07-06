import { createFileRoute, redirect } from "@tanstack/react-router";
import { ALTA_SYSTEM_STATUS_URL } from "@/lib/site/site-links";

export const Route = createFileRoute("/status/")({
  beforeLoad: () => {
    throw redirect({ href: ALTA_SYSTEM_STATUS_URL, replace: true });
  },
});
