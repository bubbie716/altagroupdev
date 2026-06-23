import { M as redirect, m as createFileRoute, p as lazyRouteComponent } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as fetchCompanyDetail } from "./company.functions-D3p9jChI.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/route-DVYT9897.js
var $$splitComponentImporter = () => import("./route-BfHqk5ZL.mjs");
var Route = createFileRoute("/companies/$companyId")({
	loader: async ({ params }) => {
		try {
			return await fetchCompanyDetail({ data: params.companyId });
		} catch {
			throw redirect({ to: "/access-restricted" });
		}
	},
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { Route as t };
