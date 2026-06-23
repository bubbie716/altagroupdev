import { a as formatDbVerificationStatus, i as formatDbCompanyType, o as fromDbAccountStatus, r as formatDbCompanyStatus, s as fromDbCompanyRole, u as toDbCompanyRole } from "./enum-map-DcayJAAj.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/company-mapper-B8STUrpr.js
var COMPANY_TYPE_TO_DB = {
	private_company: "PRIVATE_COMPANY",
	listed_company: "LISTED_COMPANY",
	bank: "BANK",
	brokerage: "BROKERAGE",
	issuer: "ISSUER",
	institution: "INSTITUTION"
};
var COMPANY_TYPE_FROM_DB = {
	PRIVATE_COMPANY: "private_company",
	LISTED_COMPANY: "listed_company",
	BANK: "bank",
	BROKERAGE: "brokerage",
	ISSUER: "issuer",
	INSTITUTION: "institution"
};
function toDbCompanyType(type) {
	return COMPANY_TYPE_TO_DB[type];
}
function fromDbCompanyTypeValue(type) {
	return COMPANY_TYPE_FROM_DB[type];
}
function parseIntendedUses(values) {
	const allowed = [
		"business_banking",
		"ipo_listing",
		"issuer_portal",
		"api_access",
		"other"
	];
	return values.filter((v) => allowed.includes(v));
}
function mapMember(membership) {
	return {
		membershipId: membership.id,
		userId: membership.userId,
		discordUsername: membership.user.discordUsername,
		minecraftUsername: membership.user.minecraftUsername,
		role: fromDbCompanyRole(membership.role),
		joinedAt: membership.createdAt.toISOString(),
		accountStatus: formatDbAccountStatusLabel(fromDbAccountStatus(membership.user.accountStatus))
	};
}
function formatDbAccountStatusLabel(status) {
	return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function mapCompanySummary(company, role) {
	return {
		id: company.id,
		name: company.name,
		type: formatDbCompanyType(company.type),
		sector: company.sector,
		ticker: company.ticker,
		desiredTicker: company.desiredTicker,
		status: formatDbCompanyStatus(company.status),
		verificationStatus: formatDbVerificationStatus(company.verificationStatus),
		role,
		createdAt: company.createdAt.toISOString()
	};
}
function mapCompanyDetail(company, currentUserId, currentUserRole) {
	const canManage = currentUserRole === "owner" || currentUserRole === "executive";
	const members = company.memberships.map(mapMember).sort((a, b) => a.joinedAt.localeCompare(b.joinedAt));
	return {
		id: company.id,
		name: company.name,
		type: formatDbCompanyType(company.type),
		typeValue: fromDbCompanyTypeValue(company.type),
		sector: company.sector,
		description: company.description,
		headquarters: company.headquarters,
		ticker: company.ticker,
		desiredTicker: company.desiredTicker,
		primaryContactDiscordUsername: company.primaryContactDiscordUsername,
		intendedUses: parseIntendedUses(company.intendedUses),
		status: formatDbCompanyStatus(company.status),
		verificationStatus: formatDbVerificationStatus(company.verificationStatus),
		createdAt: company.createdAt.toISOString(),
		updatedAt: company.updatedAt.toISOString(),
		currentUserRole,
		canManage,
		canManageMembers: canManage,
		canEditSettings: currentUserRole === "owner",
		members,
		memberCount: members.length
	};
}
function mapInternalCompanyRow(company) {
	return {
		id: company.id,
		name: company.name,
		ticker: company.ticker,
		type: formatDbCompanyType(company.type),
		sector: company.sector,
		status: formatDbCompanyStatus(company.status),
		verificationStatus: formatDbVerificationStatus(company.verificationStatus),
		representativeCount: company._count.memberships,
		primaryContact: company.primaryContactDiscordUsername ?? "—",
		lastUpdated: company.updatedAt.toISOString().slice(0, 10)
	};
}
function toDbMemberRole(role) {
	return toDbCompanyRole(role);
}
//#endregion
export { mapCompanyDetail, mapCompanySummary, mapInternalCompanyRow, toDbCompanyType, toDbMemberRole };
