import { m as createFileRoute, p as lazyRouteComponent } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as fetchUserCompanies } from "./company.functions-D3p9jChI.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/companies-D7zT-_eM.js
var $$splitComponentImporter = () => import("./companies-DF534amW.mjs");
var Route = createFileRoute("/companies/")({
	loader: () => fetchUserCompanies(),
	head: () => ({ meta: [{ title: "Companies — Alta Group" }] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { Route as t };
