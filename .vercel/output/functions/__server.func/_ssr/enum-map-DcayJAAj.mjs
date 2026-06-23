import { r as __exportAll } from "../_runtime.mjs";
import { t as __exportAll$1 } from "./rolldown-runtime-D7D4PA-g.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/enum-map-DcayJAAj.js
var enum_map_DcayJAAj_exports = /* @__PURE__ */ __exportAll({
	a: () => formatDbVerificationStatus,
	c: () => fromDbDeveloperAccessStatus,
	d: () => toDbDeveloperAccessStatus,
	f: () => toDbUserTag,
	i: () => formatDbCompanyType,
	l: () => fromDbUserTag,
	n: () => enum_map_exports,
	o: () => fromDbAccountStatus,
	r: () => formatDbCompanyStatus,
	s: () => fromDbCompanyRole,
	t: () => developerAccessGranted,
	u: () => toDbCompanyRole
});
var enum_map_exports = /* @__PURE__ */ __exportAll$1({
	developerAccessGranted: () => developerAccessGranted,
	formatDbCompanyStatus: () => formatDbCompanyStatus,
	formatDbCompanyType: () => formatDbCompanyType,
	formatDbVerificationStatus: () => formatDbVerificationStatus,
	fromDbAccountStatus: () => fromDbAccountStatus,
	fromDbCompanyRole: () => fromDbCompanyRole,
	fromDbDeveloperAccessStatus: () => fromDbDeveloperAccessStatus,
	fromDbUserTag: () => fromDbUserTag,
	toDbCompanyRole: () => toDbCompanyRole,
	toDbDeveloperAccessStatus: () => toDbDeveloperAccessStatus,
	toDbUserTag: () => toDbUserTag
});
var USER_TAG_TO_DB = {
	admin: "ADMIN",
	operator: "OPERATOR",
	private_client: "PRIVATE_CLIENT",
	developer: "DEVELOPER",
	issuer: "ISSUER"
};
var USER_TAG_FROM_DB = {
	ADMIN: "admin",
	OPERATOR: "operator",
	PRIVATE_CLIENT: "private_client",
	DEVELOPER: "developer",
	ISSUER: "issuer"
};
var ACCOUNT_STATUS_FROM_DB = {
	ACTIVE: "active",
	RESTRICTED: "restricted",
	FROZEN: "frozen",
	PENDING_REVIEW: "pending_review"
};
var DEVELOPER_ACCESS_TO_DB = {
	none: "NONE",
	pending: "PENDING",
	approved: "APPROVED",
	suspended: "SUSPENDED"
};
var DEVELOPER_ACCESS_FROM_DB = {
	NONE: "none",
	PENDING: "pending",
	APPROVED: "approved",
	SUSPENDED: "suspended"
};
var COMPANY_ROLE_TO_DB = {
	owner: "OWNER",
	executive: "EXECUTIVE",
	finance_manager: "FINANCE_MANAGER",
	compliance_contact: "COMPLIANCE_CONTACT",
	viewer: "VIEWER"
};
var COMPANY_ROLE_FROM_DB = {
	OWNER: "owner",
	EXECUTIVE: "executive",
	FINANCE_MANAGER: "finance_manager",
	COMPLIANCE_CONTACT: "compliance_contact",
	VIEWER: "viewer"
};
function toDbUserTag(tag) {
	return USER_TAG_TO_DB[tag];
}
function fromDbUserTag(tag) {
	return USER_TAG_FROM_DB[tag];
}
function fromDbAccountStatus(status) {
	return ACCOUNT_STATUS_FROM_DB[status];
}
function toDbDeveloperAccessStatus(status) {
	return DEVELOPER_ACCESS_TO_DB[status];
}
function fromDbDeveloperAccessStatus(status) {
	return DEVELOPER_ACCESS_FROM_DB[status];
}
function toDbCompanyRole(role) {
	return COMPANY_ROLE_TO_DB[role];
}
function fromDbCompanyRole(role) {
	return COMPANY_ROLE_FROM_DB[role];
}
function formatDbCompanyType(type) {
	return type.split("_").map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join(" ");
}
function formatDbCompanyStatus(status) {
	return status.charAt(0) + status.slice(1).toLowerCase();
}
function formatDbVerificationStatus(status) {
	if (status === "UNVERIFIED") return "Unverified";
	if (status === "PENDING") return "Pending Review";
	return status.charAt(0) + status.slice(1).toLowerCase();
}
function developerAccessGranted(status) {
	return status === "approved";
}
//#endregion
export { formatDbVerificationStatus as a, fromDbDeveloperAccessStatus as c, toDbDeveloperAccessStatus as d, toDbUserTag as f, formatDbCompanyType as i, fromDbUserTag as l, enum_map_DcayJAAj_exports as n, fromDbAccountStatus as o, formatDbCompanyStatus as r, fromDbCompanyRole as s, developerAccessGranted as t, toDbCompanyRole as u };
