import { M as redirect, m as createFileRoute, p as lazyRouteComponent } from "../_libs/@tanstack/react-router+[...].mjs";
import { c as verifyInternalAccess, l as verifyIssuerPortalAccess, s as verifyDeveloperAccess, u as verifyPrivateClientAccess } from "./auth.functions-AvLZQ5C2.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/owner-DmpqlVOr.js
function authBeforeLoad({ context, location }) {
	if (context.user) return;
	throw redirect({
		to: "/login",
		search: { redirect: location.pathname }
	});
}
async function requireSignedIn({ context, location }) {
	if (!context.user) throw redirect({
		to: "/login",
		search: { redirect: location.pathname }
	});
}
async function requireAccess(context, verify) {
	await requireSignedIn(context);
	if (!await verify()) throw redirect({ to: "/access-restricted" });
}
async function internalBeforeLoad(context) {
	await requireAccess(context, verifyInternalAccess);
}
async function privateClientBeforeLoad(context) {
	await requireAccess(context, verifyPrivateClientAccess);
}
async function developerBeforeLoad(context) {
	await requireAccess(context, verifyDeveloperAccess);
}
async function issuerPortalBeforeLoad(context) {
	await requireSignedIn(context);
	if (!await verifyIssuerPortalAccess({ data: { ticker: context.params.ticker } })) throw redirect({ to: "/access-restricted" });
}
var $$splitComponentImporter = () => import("./owner-Cebzr0fm.mjs");
var Route = createFileRoute("/exchange/company/$ticker/owner")({
	beforeLoad: issuerPortalBeforeLoad,
	head: ({ params }) => ({ meta: [{ title: `Issuer Portal · ${params.ticker.toUpperCase()} — Alta Exchange` }] }),
	component: lazyRouteComponent($$splitComponentImporter, "component")
});
//#endregion
export { privateClientBeforeLoad as a, internalBeforeLoad as i, authBeforeLoad as n, developerBeforeLoad as r, Route as t };
