import { m as createFileRoute, p as lazyRouteComponent } from "./_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_ticker-BQaoGd4-.js
var $$splitComponentImporter = () => import("./_ticker-DRaVuaAd.mjs");
var Route = createFileRoute("/exchange/company/$ticker/")({
	head: ({ params }) => ({ meta: [{ title: `${params.ticker.toUpperCase()} — Alta Exchange` }] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { Route as t };
