import { l as createServerFn } from "./esm-Dova13aH.mjs";
import { t as createServerRpc } from "./createServerRpc-WJgk8O8C.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/company.functions-RR6ReucV.js
async function actorId() {
	const { requireAuth } = await import("./auth.service-C-cH6bR2.mjs").then((n) => n.t);
	return (await requireAuth()).id;
}
var fetchUserCompanies_createServerFn_handler = createServerRpc({
	id: "440aea60350a2f954140506d57bf5600900a491f42082b83b92f9e12713b97c9",
	name: "fetchUserCompanies",
	filename: "src/lib/company/company.functions.ts"
}, (opts) => fetchUserCompanies.__executeServer(opts));
var fetchUserCompanies = createServerFn({ method: "GET" }).handler(fetchUserCompanies_createServerFn_handler, async () => {
	const { listUserCompanies } = await import("./company.service-rPFvF5rm.mjs");
	return listUserCompanies(await actorId());
});
var fetchCompanyDetail_createServerFn_handler = createServerRpc({
	id: "0951576a8950a3ec6648bad673435ecf79f4702a86cbd4b0af5d0672c573f814",
	name: "fetchCompanyDetail",
	filename: "src/lib/company/company.functions.ts"
}, (opts) => fetchCompanyDetail.__executeServer(opts));
var fetchCompanyDetail = createServerFn({ method: "GET" }).validator((companyId) => companyId).handler(fetchCompanyDetail_createServerFn_handler, async ({ data: companyId }) => {
	const { getCompanyDetailForUser } = await import("./company.service-rPFvF5rm.mjs");
	return getCompanyDetailForUser(companyId, await actorId());
});
var createCompanyRecord_createServerFn_handler = createServerRpc({
	id: "dd3ed99373b3a6b76ccc48e4f2a4a029f59b0f16ee4f3432914fda53bc2ab926",
	name: "createCompanyRecord",
	filename: "src/lib/company/company.functions.ts"
}, (opts) => createCompanyRecord.__executeServer(opts));
var createCompanyRecord = createServerFn({ method: "POST" }).validator((input) => input).handler(createCompanyRecord_createServerFn_handler, async ({ data }) => {
	const { createCompany } = await import("./company.service-rPFvF5rm.mjs");
	return createCompany(await actorId(), data);
});
var updateCompanySettingsRecord_createServerFn_handler = createServerRpc({
	id: "f795d772db490916d5764375eb1c4d2bbe928df6b1a777629454179e22d03bfe",
	name: "updateCompanySettingsRecord",
	filename: "src/lib/company/company.functions.ts"
}, (opts) => updateCompanySettingsRecord.__executeServer(opts));
var updateCompanySettingsRecord = createServerFn({ method: "POST" }).validator((input) => input).handler(updateCompanySettingsRecord_createServerFn_handler, async ({ data }) => {
	const { updateCompanySettings } = await import("./company.service-rPFvF5rm.mjs");
	return updateCompanySettings(await actorId(), data);
});
var updateCompanyMemberRole_createServerFn_handler = createServerRpc({
	id: "8a0fbe3cdde2d7ed9e252779c7ace04dae3e441d2fc8245491c7bf2a898560d2",
	name: "updateCompanyMemberRole",
	filename: "src/lib/company/company.functions.ts"
}, (opts) => updateCompanyMemberRole.__executeServer(opts));
var updateCompanyMemberRole = createServerFn({ method: "POST" }).validator((input) => input).handler(updateCompanyMemberRole_createServerFn_handler, async ({ data }) => {
	const { updateMemberRole } = await import("./company.service-rPFvF5rm.mjs");
	await updateMemberRole(await actorId(), data);
	return { ok: true };
});
var removeCompanyMember_createServerFn_handler = createServerRpc({
	id: "b86d649c66031958ae6b071efbe36c2f7d46ca9e5b489c0e2a8f7a658cd2df2c",
	name: "removeCompanyMember",
	filename: "src/lib/company/company.functions.ts"
}, (opts) => removeCompanyMember.__executeServer(opts));
var removeCompanyMember = createServerFn({ method: "POST" }).validator((input) => input).handler(removeCompanyMember_createServerFn_handler, async ({ data }) => {
	const { removeMember } = await import("./company.service-rPFvF5rm.mjs");
	await removeMember(await actorId(), data);
	return { ok: true };
});
var addCompanyMemberByDiscord_createServerFn_handler = createServerRpc({
	id: "94da999a0933054ab3cb74966387ad16f3a281416af63d7e9ac3a28159613010",
	name: "addCompanyMemberByDiscord",
	filename: "src/lib/company/company.functions.ts"
}, (opts) => addCompanyMemberByDiscord.__executeServer(opts));
var addCompanyMemberByDiscord = createServerFn({ method: "POST" }).validator((input) => input).handler(addCompanyMemberByDiscord_createServerFn_handler, async ({ data }) => {
	const { addMemberByDiscord } = await import("./company.service-rPFvF5rm.mjs");
	return addMemberByDiscord(await actorId(), data);
});
var fetchInternalCompaniesFromDb_createServerFn_handler = createServerRpc({
	id: "acc17047ceb58a5b4f30bbc64e7142cda91c5f3d79fee7a7b7e02cdc0c51f0dc",
	name: "fetchInternalCompaniesFromDb",
	filename: "src/lib/company/company.functions.ts"
}, (opts) => fetchInternalCompaniesFromDb.__executeServer(opts));
var fetchInternalCompaniesFromDb = createServerFn({ method: "GET" }).handler(fetchInternalCompaniesFromDb_createServerFn_handler, async () => {
	const { listInternalCompanies } = await import("./company.service-rPFvF5rm.mjs");
	const { requireOperator } = await import("./permissions.service-CglihG-v.mjs");
	await requireOperator();
	return listInternalCompanies();
});
var fetchInternalCompanyFromDb_createServerFn_handler = createServerRpc({
	id: "cd298f43baf09dc17f99eb5d3c8ffde6b58b3a6d28edb4328d90b16eb823af6a",
	name: "fetchInternalCompanyFromDb",
	filename: "src/lib/company/company.functions.ts"
}, (opts) => fetchInternalCompanyFromDb.__executeServer(opts));
var fetchInternalCompanyFromDb = createServerFn({ method: "GET" }).validator((companyId) => companyId).handler(fetchInternalCompanyFromDb_createServerFn_handler, async ({ data: companyId }) => {
	const { getInternalCompanyDetail } = await import("./company.service-rPFvF5rm.mjs");
	const { requireOperator } = await import("./permissions.service-CglihG-v.mjs");
	const { mapCompanyDetail } = await import("./company-mapper-B8STUrpr.mjs");
	const { fromDbCompanyRole } = await import("./enum-map-DcayJAAj.mjs").then((n) => n.n).then((n) => n.n);
	await requireOperator();
	const company = await getInternalCompanyDetail(companyId);
	if (!company) return null;
	const ownerMembership = company.memberships.find((m) => m.role === "OWNER") ?? company.memberships[0];
	const role = ownerMembership ? fromDbCompanyRole(ownerMembership.role) : "viewer";
	return mapCompanyDetail(company, ownerMembership?.userId ?? "", role);
});
//#endregion
export { addCompanyMemberByDiscord_createServerFn_handler, createCompanyRecord_createServerFn_handler, fetchCompanyDetail_createServerFn_handler, fetchInternalCompaniesFromDb_createServerFn_handler, fetchInternalCompanyFromDb_createServerFn_handler, fetchUserCompanies_createServerFn_handler, removeCompanyMember_createServerFn_handler, updateCompanyMemberRole_createServerFn_handler, updateCompanySettingsRecord_createServerFn_handler };
