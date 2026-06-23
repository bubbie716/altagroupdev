import { s as fromDbCompanyRole } from "./enum-map-DcayJAAj.mjs";
import { a as prisma, r as requireAuth } from "./auth.service-C-cH6bR2.mjs";
import { mapCompanyDetail, mapCompanySummary, mapInternalCompanyRow, toDbCompanyType, toDbMemberRole } from "./company-mapper-B8STUrpr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/company.service-rPFvF5rm.js
function forbidden() {
	throw new Error("FORBIDDEN");
}
function notFound() {
	throw new Error("NOT_FOUND");
}
async function requireMembership(companyId, userId) {
	const membership = await prisma.companyMembership.findUnique({ where: { userId_companyId: {
		userId,
		companyId
	} } });
	if (!membership) forbidden();
	return membership;
}
function canManageMembers(role) {
	return role === "owner" || role === "executive";
}
var companyWithMembersInclude = { memberships: {
	include: { user: true },
	orderBy: { createdAt: "asc" }
} };
async function listUserCompanies(userId) {
	return (await prisma.companyMembership.findMany({
		where: { userId },
		include: { company: true },
		orderBy: { company: { name: "asc" } }
	})).map((m) => mapCompanySummary(m.company, fromDbCompanyRole(m.role)));
}
async function getCompanyDetailForUser(companyId, userId) {
	const membership = await requireMembership(companyId, userId);
	const company = await prisma.company.findUnique({
		where: { id: companyId },
		include: companyWithMembersInclude
	});
	if (!company) notFound();
	return mapCompanyDetail(company, userId, fromDbCompanyRole(membership.role));
}
async function createCompany(userId, input) {
	const desiredTicker = input.desiredTicker?.trim().toUpperCase() || null;
	return { companyId: (await prisma.company.create({ data: {
		name: input.name.trim(),
		type: toDbCompanyType(input.type),
		sector: input.sector.trim(),
		desiredTicker,
		description: input.description.trim(),
		headquarters: input.headquarters?.trim() || null,
		primaryContactDiscordUsername: input.primaryContactDiscordUsername.trim(),
		intendedUses: input.intendedUses,
		status: "PENDING",
		verificationStatus: "UNVERIFIED",
		memberships: { create: {
			userId,
			role: "OWNER"
		} }
	} })).id };
}
async function updateCompanySettings(userId, input) {
	if (fromDbCompanyRole((await requireMembership(input.companyId, userId)).role) !== "owner") forbidden();
	const existing = await prisma.company.findUnique({ where: { id: input.companyId } });
	if (!existing) notFound();
	const desiredTicker = existing.ticker === null ? input.desiredTicker?.trim().toUpperCase() || null : existing.desiredTicker;
	await prisma.company.update({
		where: { id: input.companyId },
		data: {
			name: input.name.trim(),
			sector: input.sector.trim(),
			description: input.description.trim(),
			headquarters: input.headquarters?.trim() || null,
			desiredTicker
		}
	});
	return { companyId: input.companyId };
}
async function updateMemberRole(actorUserId, input) {
	const actorRole = fromDbCompanyRole((await requireMembership(input.companyId, actorUserId)).role);
	if (!canManageMembers(actorRole)) forbidden();
	const target = await prisma.companyMembership.findFirst({ where: {
		id: input.membershipId,
		companyId: input.companyId
	} });
	if (!target) notFound();
	const targetRole = fromDbCompanyRole(target.role);
	const nextRole = input.role;
	if (actorRole === "executive") {
		if (targetRole === "owner" || nextRole === "owner") forbidden();
	}
	if (targetRole === "owner" && nextRole !== "owner") {
		if (await prisma.companyMembership.count({ where: {
			companyId: input.companyId,
			role: "OWNER"
		} }) <= 1) forbidden();
	}
	await prisma.companyMembership.update({
		where: { id: input.membershipId },
		data: { role: toDbMemberRole(nextRole) }
	});
}
async function removeMember(actorUserId, input) {
	const actorRole = fromDbCompanyRole((await requireMembership(input.companyId, actorUserId)).role);
	if (!canManageMembers(actorRole)) forbidden();
	const target = await prisma.companyMembership.findFirst({ where: {
		id: input.membershipId,
		companyId: input.companyId
	} });
	if (!target) notFound();
	const targetRole = fromDbCompanyRole(target.role);
	if (actorRole === "executive" && targetRole === "owner") forbidden();
	if (targetRole === "owner") {
		if (await prisma.companyMembership.count({ where: {
			companyId: input.companyId,
			role: "OWNER"
		} }) <= 1) forbidden();
	}
	await prisma.companyMembership.delete({ where: { id: input.membershipId } });
}
async function addMemberByDiscord(actorUserId, input) {
	const actorRole = fromDbCompanyRole((await requireMembership(input.companyId, actorUserId)).role);
	if (!canManageMembers(actorRole)) forbidden();
	if (actorRole === "executive" && input.role === "owner") forbidden();
	const identifier = input.discordIdentifier.trim();
	const user = await prisma.user.findFirst({ where: { OR: [{ discordId: identifier }, { discordUsername: {
		equals: identifier,
		mode: "insensitive"
	} }] } });
	if (!user) notFound();
	if (await prisma.companyMembership.findUnique({ where: { userId_companyId: {
		userId: user.id,
		companyId: input.companyId
	} } })) throw new Error("ALREADY_MEMBER");
	await prisma.companyMembership.create({ data: {
		userId: user.id,
		companyId: input.companyId,
		role: toDbMemberRole(input.role)
	} });
	return {
		added: true,
		username: user.discordUsername
	};
}
async function listInternalCompanies() {
	await requireAuth();
	return (await prisma.company.findMany({
		include: { _count: { select: { memberships: true } } },
		orderBy: { updatedAt: "desc" }
	})).map(mapInternalCompanyRow);
}
async function getInternalCompanyDetail(companyId) {
	await requireAuth();
	return prisma.company.findUnique({
		where: { id: companyId },
		include: companyWithMembersInclude
	});
}
//#endregion
export { addMemberByDiscord, createCompany, getCompanyDetailForUser, getInternalCompanyDetail, listInternalCompanies, listUserCompanies, removeMember, updateCompanySettings, updateMemberRole };
