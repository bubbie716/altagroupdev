import { m as createFileRoute, p as lazyRouteComponent } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/owner-CesO7VPV.js
var $$splitComponentImporter = () => import("./owner-jiAOjz-l.mjs");
var Route = createFileRoute("/exchange/company/$ticker/owner")({
	head: ({ params }) => ({ meta: [{ title: `Issuer Portal · ${params.ticker.toUpperCase()} — Alta Exchange` }] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { Route as t };
