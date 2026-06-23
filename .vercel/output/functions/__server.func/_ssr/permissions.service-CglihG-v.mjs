import { t as canAccessInternal } from "./permissions-DFFnJwMM.mjs";
import { r as requireAuth } from "./auth.service-C-cH6bR2.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/permissions.service-CglihG-v.js
function forbid() {
	throw new Error("FORBIDDEN");
}
/** Internal console access — admin or operator. */
async function requireOperator() {
	const user = await requireAuth();
	if (!canAccessInternal(user)) forbid();
	return user;
}
//#endregion
export { requireOperator };
