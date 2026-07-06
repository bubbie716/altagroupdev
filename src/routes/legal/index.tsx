import { createFileRoute, redirect } from "@tanstack/react-router";
import { LEGAL_CENTER_PATH } from "@/lib/site/site-links";

export const Route = createFileRoute("/legal/")({
  beforeLoad: () => {
    throw redirect({ to: LEGAL_CENTER_PATH, replace: true });
  },
});
