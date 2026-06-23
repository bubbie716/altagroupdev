//#region node_modules/.nitro/vite/services/ssr/assets/types-B_xrYiVU.js
var COMPANY_TYPE_OPTIONS = [
	{
		value: "private_company",
		label: "Private Company"
	},
	{
		value: "listed_company",
		label: "Listed Company"
	},
	{
		value: "issuer",
		label: "Issuer"
	},
	{
		value: "institution",
		label: "Institution"
	},
	{
		value: "bank",
		label: "Bank"
	},
	{
		value: "brokerage",
		label: "Brokerage"
	}
];
var INTENDED_USE_OPTIONS = [
	{
		value: "business_banking",
		label: "Business banking"
	},
	{
		value: "ipo_listing",
		label: "IPO / listing"
	},
	{
		value: "issuer_portal",
		label: "Exchange issuer portal"
	},
	{
		value: "api_access",
		label: "API / developer access"
	},
	{
		value: "other",
		label: "Other"
	}
];
var MEMBER_ROLE_OPTIONS = [
	{
		value: "executive",
		label: "Executive"
	},
	{
		value: "finance_manager",
		label: "Finance Manager"
	},
	{
		value: "compliance_contact",
		label: "Compliance Contact"
	},
	{
		value: "viewer",
		label: "Viewer"
	}
];
var OWNER_ROLE_OPTION = {
	value: "owner",
	label: "Owner"
};
function formatIntendedUse(use) {
	return INTENDED_USE_OPTIONS.find((o) => o.value === use)?.label ?? use;
}
//#endregion
export { formatIntendedUse as a, OWNER_ROLE_OPTION as i, INTENDED_USE_OPTIONS as n, MEMBER_ROLE_OPTIONS as r, COMPANY_TYPE_OPTIONS as t };
