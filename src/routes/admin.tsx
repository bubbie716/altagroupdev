import { createFileRoute, redirect } from "@tanstack/react-router";
import { NccAdminPage } from "@/components/ncc/ncc-admin-page";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/admin")({
  beforeLoad: (opts) => {
    if (opts.context.site.key !== "ncc") {
      throw redirect({ to: "/" });
    }
    return authBeforeLoad(opts);
  },
  head: () => ({
    meta: [{ title: "Admin Panel — Newport Clearing Corporation" }],
  }),
  component: NccAdminPage,
});
