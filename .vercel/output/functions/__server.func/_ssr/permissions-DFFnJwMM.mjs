import { r as __exportAll } from "../_runtime.mjs";
import { t as __exportAll$1 } from "./rolldown-runtime-D7D4PA-g.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/permissions-DFFnJwMM.js
var permissions_DFFnJwMM_exports = /* @__PURE__ */ __exportAll({
	a: () => canAccessInternal$1,
	c: () => formatUserTag,
	i: () => permissions_exports,
	n: () => findCompanyMembership,
	o: () => formatAccountStatus,
	r: () => isPrivateClient,
	s: () => formatCompanyRole,
	t: () => canAccessInternal
});
function hasTag(user, tag) {
	return user.tags.includes(tag);
}
function canAccessInternal$1(user) {
	return canAccessInternal(user);
}
function formatCompanyRole(role) {
	return role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function formatAccountStatus(status) {
	return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
var USER_TAG_LABELS = {
	admin: "Admin",
	operator: "Operator",
	private_client: "Private Client",
	developer: "Developer",
	issuer: "Issuer"
};
function formatUserTag(tag) {
	return USER_TAG_LABELS[tag];
}
var permissions_exports = /* @__PURE__ */ __exportAll$1({
	ISSUER_PORTAL_ROLES: () => ISSUER_PORTAL_ROLES,
	canAccessInternal: () => canAccessInternal,
	canAccessIssuerPortal: () => canAccessIssuerPortal,
	findCompanyMembership: () => findCompanyMembership,
	isAdmin: () => isAdmin,
	isDeveloper: () => isDeveloper,
	isOperator: () => isOperator,
	isPrivateClient: () => isPrivateClient
});
/** Company roles that may access the issuer portal (VIEWER excluded). */
var ISSUER_PORTAL_ROLES = [
	"owner",
	"executive",
	"finance_manager",
	"compliance_contact"
];
function normalizeTicker(ticker) {
	return ticker.trim().toUpperCase();
}
function findCompanyMembership(user, scope) {
	if (scope.companyId) return user.companyMemberships.find((m) => m.companyId === scope.companyId);
	if (scope.ticker) {
		const target = normalizeTicker(scope.ticker);
		return user.companyMemberships.find((m) => m.companyTicker && normalizeTicker(m.companyTicker) === target);
	}
}
function hasCompanyRole(user, scope, roles) {
	const membership = findCompanyMembership(user, scope);
	return membership ? roles.includes(membership.role) : false;
}
function isAdmin(user) {
	return hasTag(user, "admin");
}
function isOperator(user) {
	return hasTag(user, "operator");
}
function isPrivateClient(user) {
	return hasTag(user, "private_client");
}
/** Developer tag or approved developer access workflow on the user record. */
function isDeveloper(user) {
	return hasTag(user, "developer") || user.developerAccess;
}
/** Internal console: admin (full) or operator (non-admin internal). */
function canAccessInternal(user) {
	return isAdmin(user) || isOperator(user);
}
function canAccessIssuerPortal(user, scope) {
	return hasCompanyRole(user, scope, ISSUER_PORTAL_ROLES);
}
//#endregion
export { formatCompanyRole as a, permissions_DFFnJwMM_exports as c, formatAccountStatus as i, canAccessInternal$1 as n, formatUserTag as o, findCompanyMembership as r, isPrivateClient as s, canAccessInternal as t };
