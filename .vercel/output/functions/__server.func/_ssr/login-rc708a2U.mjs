import { m as createFileRoute, p as lazyRouteComponent } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/login-rc708a2U.js
var $$splitComponentImporter = () => import("./login-D0_tRoyr.mjs");
var Route = createFileRoute("/login")({
	validateSearch: (search) => ({
		redirect: typeof search.redirect === "string" ? search.redirect : void 0,
		error: typeof search.error === "string" ? search.error : void 0
	}),
	head: () => ({ meta: [{ title: "Sign In — Alta Group" }] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { Route as t };
