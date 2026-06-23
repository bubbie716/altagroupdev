import { l as createServerFn } from "./esm-Dova13aH.mjs";
import { r as createSsrRpc } from "./auth.functions-AvLZQ5C2.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/company.functions-D3p9jChI.js
var fetchUserCompanies = createServerFn({ method: "GET" }).handler(createSsrRpc("440aea60350a2f954140506d57bf5600900a491f42082b83b92f9e12713b97c9"));
var fetchCompanyDetail = createServerFn({ method: "GET" }).validator((companyId) => companyId).handler(createSsrRpc("0951576a8950a3ec6648bad673435ecf79f4702a86cbd4b0af5d0672c573f814"));
var createCompanyRecord = createServerFn({ method: "POST" }).validator((input) => input).handler(createSsrRpc("dd3ed99373b3a6b76ccc48e4f2a4a029f59b0f16ee4f3432914fda53bc2ab926"));
var updateCompanySettingsRecord = createServerFn({ method: "POST" }).validator((input) => input).handler(createSsrRpc("f795d772db490916d5764375eb1c4d2bbe928df6b1a777629454179e22d03bfe"));
var updateCompanyMemberRole = createServerFn({ method: "POST" }).validator((input) => input).handler(createSsrRpc("8a0fbe3cdde2d7ed9e252779c7ace04dae3e441d2fc8245491c7bf2a898560d2"));
var removeCompanyMember = createServerFn({ method: "POST" }).validator((input) => input).handler(createSsrRpc("b86d649c66031958ae6b071efbe36c2f7d46ca9e5b489c0e2a8f7a658cd2df2c"));
var addCompanyMemberByDiscord = createServerFn({ method: "POST" }).validator((input) => input).handler(createSsrRpc("94da999a0933054ab3cb74966387ad16f3a281416af63d7e9ac3a28159613010"));
var fetchInternalCompaniesFromDb = createServerFn({ method: "GET" }).handler(createSsrRpc("acc17047ceb58a5b4f30bbc64e7142cda91c5f3d79fee7a7b7e02cdc0c51f0dc"));
var fetchInternalCompanyFromDb = createServerFn({ method: "GET" }).validator((companyId) => companyId).handler(createSsrRpc("cd298f43baf09dc17f99eb5d3c8ffde6b58b3a6d28edb4328d90b16eb823af6a"));
//#endregion
export { fetchInternalCompanyFromDb as a, updateCompanyMemberRole as c, fetchInternalCompaniesFromDb as i, updateCompanySettingsRecord as l, createCompanyRecord as n, fetchUserCompanies as o, fetchCompanyDetail as r, removeCompanyMember as s, addCompanyMemberByDiscord as t };
