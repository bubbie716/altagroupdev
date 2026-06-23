import { m as createFileRoute, p as lazyRouteComponent } from "./_libs/@tanstack/react-router+[...].mjs";
import { c as getCompanyById } from "./_ssr/api-CbUtwIPv.mjs";
import { a as fetchInternalCompanyFromDb } from "./_ssr/company.functions-D3p9jChI.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_companyId-ChpqZn4h.js
var $$splitComponentImporter = () => import("./_companyId-DOkJowg4.mjs");
var Route = createFileRoute("/internal/companies/$companyId")({
	loader: async ({ params }) => {
		try {
			const dbCompany = await fetchInternalCompanyFromDb({ data: params.companyId });
			if (dbCompany) return {
				source: "db",
				company: dbCompany
			};
		} catch {}
		const mock = getCompanyById(params.companyId);
		return mock ? {
			source: "mock",
			company: mock
		} : null;
	},
	head: ({ params }) => ({ meta: [{ title: `${params.companyId} — Company — Alta Internal` }] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { Route as t };
