import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { fetchCompanyDetail } from "@/lib/company/company.functions";

export const Route = createFileRoute("/companies/$companyId")({
  loader: async ({ params }) => {
    try {
      return await fetchCompanyDetail({ data: params.companyId });
    } catch {
      throw redirect({ to: "/access-restricted" });
    }
  },
  component: () => <Outlet />,
});
