import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import { i as setResponseHeader, t as getRequestHeader } from "./request-response-UDjZqsY1.mjs";
import { a as formatDbVerificationStatus, c as fromDbDeveloperAccessStatus, d as toDbDeveloperAccessStatus, f as toDbUserTag, i as formatDbCompanyType, l as fromDbUserTag, o as fromDbAccountStatus, r as formatDbCompanyStatus, s as fromDbCompanyRole, t as developerAccessGranted, u as toDbCompanyRole } from "./enum-map-DcayJAAj.mjs";
import { PrismaClient } from "@prisma/client";
//#region node_modules/.nitro/vite/services/ssr/assets/auth.service-C-cH6bR2.js
var SESSION_COOKIE = "alta_session";
var OAUTH_STATE_COOKIE = "alta_oauth_state";
var SESSION_MAX_AGE_SEC = 3600 * 24 * 7;
var OAUTH_STATE_MAX_AGE_SEC = 600;
function isProduction() {
	return true;
}
function cookieFlags(maxAge) {
	const parts = [
		"HttpOnly",
		"SameSite=Lax",
		"Path=/",
		`Max-Age=${maxAge}`
	];
	if (isProduction()) parts.push("Secure");
	return parts.join("; ");
}
function parseCookies(header) {
	if (!header) return {};
	const out = {};
	for (const part of header.split(/;\s*/)) {
		const eq = part.indexOf("=");
		if (eq === -1) continue;
		out[part.slice(0, eq)] = decodeURIComponent(part.slice(eq + 1));
	}
	return out;
}
function readCookie(name, cookieHeader) {
	return parseCookies(cookieHeader)[name] ?? null;
}
function buildSetCookie(name, value, maxAge) {
	return `${name}=${encodeURIComponent(value)}; ${cookieFlags(maxAge)}`;
}
function buildClearCookie(name) {
	const parts = [
		"HttpOnly",
		"SameSite=Lax",
		"Path=/",
		"Max-Age=0"
	];
	if (isProduction()) parts.push("Secure");
	return `${name}=; ${parts.join("; ")}`;
}
function getSessionCookieName() {
	return SESSION_COOKIE;
}
function getOAuthStateCookieName() {
	return OAUTH_STATE_COOKIE;
}
function sessionMaxAgeSec() {
	return SESSION_MAX_AGE_SEC;
}
function oauthStateMaxAgeSec() {
	return OAUTH_STATE_MAX_AGE_SEC;
}
/** Node requires absolute URLs for Response.redirect(). */
function loginErrorRedirect(request, error) {
	const url = new URL("/login", request.url);
	url.searchParams.set("error", error);
	return Response.redirect(url.toString(), 302);
}
/** Set-Cookie must be sent as separate headers — never comma-joined. */
function redirectWithSetCookies(location, cookies) {
	const headers = new Headers();
	headers.set("Location", location);
	for (const cookie of cookies) headers.append("Set-Cookie", cookie);
	return new Response(null, {
		status: 302,
		headers
	});
}
function toBase64Url(bytes) {
	let binary = "";
	for (const b of bytes) binary += String.fromCharCode(b);
	return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function fromBase64Url(value) {
	const padded = value.replace(/-/g, "+").replace(/_/g, "/");
	const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - padded.length % 4);
	const binary = atob(padded + pad);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}
async function importKey(secret) {
	return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {
		name: "HMAC",
		hash: "SHA-256"
	}, false, ["sign", "verify"]);
}
function getSessionSecret() {
	const secret = process.env.SESSION_SECRET;
	if (!secret || secret.length < 32) return null;
	return secret;
}
async function signValue(payload) {
	const secret = getSessionSecret();
	if (!secret) return null;
	const key = await importKey(secret);
	const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
	return toBase64Url(new Uint8Array(sig));
}
async function verifySignedValue(payload, signature) {
	const secret = getSessionSecret();
	if (!secret) return false;
	try {
		const key = await importKey(secret);
		return crypto.subtle.verify("HMAC", key, fromBase64Url(signature), new TextEncoder().encode(payload));
	} catch {
		return false;
	}
}
async function sealJson(data) {
	const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(data)));
	const signature = await signValue(payload);
	if (!signature) return null;
	return `${payload}.${signature}`;
}
async function unsealJson(token) {
	const dot = token.lastIndexOf(".");
	if (dot === -1) return null;
	const payload = token.slice(0, dot);
	if (!await verifySignedValue(payload, token.slice(dot + 1))) return null;
	try {
		const json = new TextDecoder().decode(fromBase64Url(payload));
		return JSON.parse(json);
	} catch {
		return null;
	}
}
function randomToken(bytes = 32) {
	const arr = new Uint8Array(bytes);
	crypto.getRandomValues(arr);
	return toBase64Url(arr);
}
var prisma = globalThis.prisma ?? new PrismaClient({ log: ["error"] });
function isDatabaseConfigured() {
	return Boolean(process.env.DATABASE_URL?.trim());
}
function discordAvatarUrl(discordId, avatar) {
	if (!avatar) return null;
	return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=128`;
}
function mapTags(user) {
	return user.tags.map((assignment) => fromDbUserTag(assignment.tag));
}
function mapMemberships(user) {
	return user.companyMemberships.map((membership) => ({
		userId: user.id,
		companyId: membership.companyId,
		role: fromDbCompanyRole(membership.role),
		companyName: membership.company.name,
		companyType: formatDbCompanyType(membership.company.type),
		companyTicker: membership.company.ticker,
		companyStatus: formatDbCompanyStatus(membership.company.status),
		companyVerificationStatus: formatDbVerificationStatus(membership.company.verificationStatus)
	}));
}
function mapDbUserToAltaUser(user) {
	const tags = mapTags(user);
	const developerAccessStatus = fromDbDeveloperAccessStatus(user.developerAccessStatus);
	return {
		id: user.id,
		discordId: user.discordId,
		discordUsername: user.discordUsername,
		avatarUrl: discordAvatarUrl(user.discordId, user.discordAvatar),
		email: user.email,
		minecraftUsername: user.minecraftUsername,
		tags,
		accountStatus: fromDbAccountStatus(user.accountStatus),
		developerAccessStatus,
		developerAccess: developerAccessGranted(developerAccessStatus),
		internalAccess: tags.includes("admin") || tags.includes("operator"),
		companyMemberships: mapMemberships(user),
		createdAt: user.createdAt.toISOString(),
		lastLoginAt: user.lastLoginAt.toISOString()
	};
}
function discordDisplayName(profile) {
	return profile.global_name?.trim() || profile.username;
}
var userWithMembershipsInclude = {
	tags: true,
	companyMemberships: { include: { company: true } }
};
async function createUserSession(userId) {
	const sessionToken = randomToken(32);
	const expiresAt = new Date(Date.now() + sessionMaxAgeSec() * 1e3);
	await prisma.session.create({ data: {
		userId,
		sessionToken,
		expiresAt
	} });
	return sessionToken;
}
async function loadUserBySessionToken(token) {
	const session = await prisma.session.findUnique({
		where: { sessionToken: token },
		include: { user: { include: userWithMembershipsInclude } }
	});
	if (!session) return null;
	if (session.expiresAt.getTime() < Date.now()) {
		await prisma.session.delete({ where: { id: session.id } }).catch(() => void 0);
		return null;
	}
	return mapDbUserToAltaUser(session.user);
}
async function deleteSessionByToken(token) {
	await prisma.session.deleteMany({ where: { sessionToken: token } });
}
var MOCK_USER_OVERRIDES = {
	/** Demo overrides for local testing (memberships, tags, statuses). */
	"000000000000000001": {
		tags: ["admin", "private_client"],
		minecraftUsername: "VaultSeeker",
		developerAccess: true,
		companyMemberships: [{
			companyId: "CO-NPC",
			role: "finance_manager"
		}]
	},
	"000000000000000002": {
		tags: ["private_client"],
		minecraftUsername: "HarborLine",
		companyMemberships: [{
			companyId: "CO-PRTH",
			role: "executive"
		}, {
			companyId: "CO-HBR",
			role: "owner"
		}]
	},
	"000000000000000003": {
		tags: [],
		minecraftUsername: "TerminalDev",
		developerAccess: true,
		companyMemberships: [{
			companyId: "CO-ALTB",
			role: "compliance_contact"
		}]
	},
	"000000000000000004": {
		tags: [],
		minecraftUsername: "HelixFounder",
		companyMemberships: [{
			companyId: "CO-HLXD",
			role: "owner"
		}]
	},
	"000000000000000005": {
		tags: ["private_client"],
		minecraftUsername: "MeridianCEO",
		companyMemberships: [{
			companyId: "CO-PRTH",
			role: "owner"
		}]
	}
};
function getMockUserOverride(discordId) {
	return MOCK_USER_OVERRIDES[discordId];
}
async function upsertUserFromDiscord(profile) {
	const existing = await prisma.user.findUnique({
		where: { discordId: profile.id },
		include: userWithMembershipsInclude
	});
	const now = /* @__PURE__ */ new Date();
	const mockOverride = getMockUserOverride(profile.id);
	const displayName = discordDisplayName(profile);
	if (existing) {
		const user = await prisma.user.update({
			where: { discordId: profile.id },
			data: {
				discordUsername: displayName,
				discordAvatar: profile.avatar,
				email: profile.email ?? void 0,
				lastLoginAt: now,
				...mockOverride?.minecraftUsername !== void 0 && { minecraftUsername: mockOverride.minecraftUsername },
				...mockOverride?.developerAccess === true && { developerAccessStatus: toDbDeveloperAccessStatus("approved") },
				...mockOverride?.developerAccess === false && { developerAccessStatus: toDbDeveloperAccessStatus("none") }
			},
			include: userWithMembershipsInclude
		});
		await syncDevMemberships(user.id, profile.id);
		await syncDevTags(user.id, profile.id);
		return mapDbUserToAltaUser(await prisma.user.findUniqueOrThrow({
			where: { id: user.id },
			include: userWithMembershipsInclude
		}));
	}
	const user = await prisma.user.create({
		data: {
			discordId: profile.id,
			discordUsername: displayName,
			discordAvatar: profile.avatar,
			email: profile.email ?? null,
			minecraftUsername: mockOverride?.minecraftUsername ?? null,
			developerAccessStatus: mockOverride?.developerAccess === true ? toDbDeveloperAccessStatus("approved") : toDbDeveloperAccessStatus("none"),
			lastLoginAt: now,
			tags: mockOverride?.tags?.length ? { create: mockOverride.tags.map((tag) => ({ tag: toDbUserTag(tag) })) } : void 0
		},
		include: userWithMembershipsInclude
	});
	await syncDevMemberships(user.id, profile.id);
	await syncDevTags(user.id, profile.id);
	return mapDbUserToAltaUser(user);
}
async function syncDevTags(userId, discordId) {
	const override = getMockUserOverride(discordId);
	if (!override?.tags?.length) return;
	for (const tag of override.tags) await prisma.userTagAssignment.upsert({
		where: { userId_tag: {
			userId,
			tag: toDbUserTag(tag)
		} },
		create: {
			userId,
			tag: toDbUserTag(tag)
		},
		update: {}
	});
}
async function syncDevMemberships(userId, discordId) {
	const override = getMockUserOverride(discordId);
	if (!override?.companyMemberships?.length) return;
	for (const membership of override.companyMemberships) {
		if (!await prisma.company.findUnique({ where: { id: membership.companyId } })) continue;
		await prisma.companyMembership.upsert({
			where: { userId_companyId: {
				userId,
				companyId: membership.companyId
			} },
			create: {
				userId,
				companyId: membership.companyId,
				role: toDbCompanyRole(membership.role)
			},
			update: { role: toDbCompanyRole(membership.role) }
		});
	}
}
var auth_service_exports = /* @__PURE__ */ __exportAll({
	clearUserSession: () => clearUserSession,
	loginWithDiscordProfile: () => loginWithDiscordProfile,
	logoutCurrentUser: () => logoutCurrentUser,
	readCurrentUser: () => readCurrentUser,
	requireAuth: () => requireAuth
});
async function readCurrentUser() {
	if (!isDatabaseConfigured()) return null;
	const cookieHeader = getRequestHeader("cookie");
	const token = readCookie(getSessionCookieName(), cookieHeader);
	if (!token) return null;
	return loadUserBySessionToken(token);
}
function clearUserSession() {
	setResponseHeader("Set-Cookie", buildClearCookie(getSessionCookieName()));
}
async function logoutCurrentUser() {
	const cookieHeader = getRequestHeader("cookie");
	const token = readCookie(getSessionCookieName(), cookieHeader);
	if (token) await deleteSessionByToken(token);
	clearUserSession();
}
async function loginWithDiscordProfile(profile) {
	if (!isDatabaseConfigured()) return null;
	const user = await upsertUserFromDiscord(profile);
	const sessionToken = await createUserSession(user.id);
	if (!sessionToken) return null;
	return {
		user,
		sessionToken
	};
}
async function requireAuth() {
	const user = await readCurrentUser();
	if (!user) throw new Error("UNAUTHORIZED");
	if (user.accountStatus === "frozen" || user.accountStatus === "restricted") throw new Error("ACCOUNT_RESTRICTED");
	return user;
}
//#endregion
export { sessionMaxAgeSec as _, prisma as a, unsealJson as c, getOAuthStateCookieName as d, getSessionCookieName as f, redirectWithSetCookies as g, readCookie as h, isDatabaseConfigured as i, buildClearCookie as l, oauthStateMaxAgeSec as m, loginWithDiscordProfile as n, randomToken as o, loginErrorRedirect as p, requireAuth as r, sealJson as s, auth_service_exports as t, buildSetCookie as u };
