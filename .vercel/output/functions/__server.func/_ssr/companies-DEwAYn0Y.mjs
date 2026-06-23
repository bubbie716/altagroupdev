import { m as createFileRoute, p as lazyRouteComponent } from "../_libs/@tanstack/react-router+[...].mjs";
import { i as fetchInternalCompaniesFromDb } from "./company.functions-D3p9jChI.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/companies-DEwAYn0Y.js
var $$splitComponentImporter = () => import("./companies-Dx5DSXe0.mjs");
var Route = createFileRoute("/internal/companies/")({
	loader: async () => {
		try {
			return await fetchInternalCompaniesFromDb();
		} catch {
			const { getCompanyAccounts } = await import("./api-CbUtwIPv.mjs").then((n) => n.t).then((n) => n.t);
			return getCompanyAccounts().map((c) => ({
				id: c.id,
				name: c.name,
				ticker: c.ticker,
				type: c.type,
				sector: c.sector,
				status: c.status,
				verificationStatus: c.verificationStatus,
				representativeCount: c.representativeCount,
				primaryContact: c.primaryContact,
				lastUpdated: c.lastUpdated
			}));
		}
	},
	head: () => ({ meta: [{ title: "Companies — Alta Internal" }] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { Route as t };
