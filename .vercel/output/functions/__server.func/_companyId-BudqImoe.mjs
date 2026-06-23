import { m as createFileRoute, p as lazyRouteComponent } from "./_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_companyId-BudqImoe.js
var $$splitComponentImporter = () => import("./_companyId-BiopI9Ic.mjs");
var Route = createFileRoute("/companies/$companyId/")({
	head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.name ?? "Company"} — Alta Group` }] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { Route as t };
