import { l as createServerFn } from "./esm-Dova13aH.mjs";
import { t as createServerRpc } from "./createServerRpc-WJgk8O8C.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/auth.functions-B1FedOFo.js
/** Load authenticated user from persisted session (RPC-safe). */
var fetchCurrentUser_createServerFn_handler = createServerRpc({
	id: "07ab98c7d9d0767d03d4a311be606fd22b3e15207d2e410fa5628e752e63548e",
	name: "fetchCurrentUser",
	filename: "src/lib/auth/auth.functions.ts"
}, (opts) => fetchCurrentUser.__executeServer(opts));
var fetchCurrentUser = createServerFn({ method: "GET" }).handler(fetchCurrentUser_createServerFn_handler, async () => {
	const { readCurrentUser } = await import("./auth.service-C-cH6bR2.mjs").then((n) => n.t);
	return readCurrentUser();
});
var verifyInternalAccess_createServerFn_handler = createServerRpc({
	id: "a0ab5e30f64119bee4f78e74fdf5da4ee035e14916671c29321c5572f20aa97c",
	name: "verifyInternalAccess",
	filename: "src/lib/auth/auth.functions.ts"
}, (opts) => verifyInternalAccess.__executeServer(opts));
var verifyInternalAccess = createServerFn({ method: "GET" }).handler(verifyInternalAccess_createServerFn_handler, async () => {
	const { readCurrentUser } = await import("./auth.service-C-cH6bR2.mjs").then((n) => n.t);
	const { canAccessInternal } = await import("./permissions-DFFnJwMM.mjs").then((n) => n.c).then((n) => n.i);
	const user = await readCurrentUser();
	return user ? canAccessInternal(user) : false;
});
var verifyPrivateClientAccess_createServerFn_handler = createServerRpc({
	id: "e3a1afeeb5f28724385453bb7804867542865c37b25db4bd251663f6d4b76053",
	name: "verifyPrivateClientAccess",
	filename: "src/lib/auth/auth.functions.ts"
}, (opts) => verifyPrivateClientAccess.__executeServer(opts));
var verifyPrivateClientAccess = createServerFn({ method: "GET" }).handler(verifyPrivateClientAccess_createServerFn_handler, async () => {
	const { readCurrentUser } = await import("./auth.service-C-cH6bR2.mjs").then((n) => n.t);
	const { isPrivateClient } = await import("./permissions-DFFnJwMM.mjs").then((n) => n.c).then((n) => n.i);
	const user = await readCurrentUser();
	return user ? isPrivateClient(user) : false;
});
var verifyDeveloperAccess_createServerFn_handler = createServerRpc({
	id: "f4d0bd53681593619da24fb073b3d7cdfc7d282fb71f629d8516af0b22f589e7",
	name: "verifyDeveloperAccess",
	filename: "src/lib/auth/auth.functions.ts"
}, (opts) => verifyDeveloperAccess.__executeServer(opts));
var verifyDeveloperAccess = createServerFn({ method: "GET" }).handler(verifyDeveloperAccess_createServerFn_handler, async () => {
	const { readCurrentUser } = await import("./auth.service-C-cH6bR2.mjs").then((n) => n.t);
	const { isDeveloper } = await import("./permissions-DFFnJwMM.mjs").then((n) => n.c).then((n) => n.i);
	const user = await readCurrentUser();
	return user ? isDeveloper(user) : false;
});
var verifyIssuerPortalAccess_createServerFn_handler = createServerRpc({
	id: "7050472322b6db171cd736fd8c1ccb908164f69c2d9e97455d469ee77e9a3a23",
	name: "verifyIssuerPortalAccess",
	filename: "src/lib/auth/auth.functions.ts"
}, (opts) => verifyIssuerPortalAccess.__executeServer(opts));
var verifyIssuerPortalAccess = createServerFn({ method: "GET" }).validator((input) => input).handler(verifyIssuerPortalAccess_createServerFn_handler, async ({ data }) => {
	const { readCurrentUser } = await import("./auth.service-C-cH6bR2.mjs").then((n) => n.t);
	const { canAccessIssuerPortal } = await import("./permissions-DFFnJwMM.mjs").then((n) => n.c).then((n) => n.i);
	const user = await readCurrentUser();
	return user ? canAccessIssuerPortal(user, { ticker: data.ticker }) : false;
});
var logoutUser_createServerFn_handler = createServerRpc({
	id: "6e36ea5d2ba8019d6aaff2e4ad493c00a5a5b8ae3fbe14a1ac92a355257ab3c3",
	name: "logoutUser",
	filename: "src/lib/auth/auth.functions.ts"
}, (opts) => logoutUser.__executeServer(opts));
var logoutUser = createServerFn({ method: "POST" }).handler(logoutUser_createServerFn_handler, async () => {
	const { logoutCurrentUser } = await import("./auth.service-C-cH6bR2.mjs").then((n) => n.t);
	await logoutCurrentUser();
	return { ok: true };
});
//#endregion
export { fetchCurrentUser_createServerFn_handler, logoutUser_createServerFn_handler, verifyDeveloperAccess_createServerFn_handler, verifyInternalAccess_createServerFn_handler, verifyIssuerPortalAccess_createServerFn_handler, verifyPrivateClientAccess_createServerFn_handler };
