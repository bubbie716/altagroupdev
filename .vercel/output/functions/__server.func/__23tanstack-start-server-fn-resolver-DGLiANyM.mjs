//#region node_modules/.nitro/vite/services/ssr/assets/__23tanstack-start-server-fn-resolver-DGLiANyM.js
var manifest = {
	"07ab98c7d9d0767d03d4a311be606fd22b3e15207d2e410fa5628e752e63548e": {
		functionName: "fetchCurrentUser_createServerFn_handler",
		importer: () => import("./_ssr/auth.functions-B1FedOFo.mjs")
	},
	"0951576a8950a3ec6648bad673435ecf79f4702a86cbd4b0af5d0672c573f814": {
		functionName: "fetchCompanyDetail_createServerFn_handler",
		importer: () => import("./_ssr/company.functions-RR6ReucV.mjs")
	},
	"440aea60350a2f954140506d57bf5600900a491f42082b83b92f9e12713b97c9": {
		functionName: "fetchUserCompanies_createServerFn_handler",
		importer: () => import("./_ssr/company.functions-RR6ReucV.mjs")
	},
	"6e36ea5d2ba8019d6aaff2e4ad493c00a5a5b8ae3fbe14a1ac92a355257ab3c3": {
		functionName: "logoutUser_createServerFn_handler",
		importer: () => import("./_ssr/auth.functions-B1FedOFo.mjs")
	},
	"7050472322b6db171cd736fd8c1ccb908164f69c2d9e97455d469ee77e9a3a23": {
		functionName: "verifyIssuerPortalAccess_createServerFn_handler",
		importer: () => import("./_ssr/auth.functions-B1FedOFo.mjs")
	},
	"8a0fbe3cdde2d7ed9e252779c7ace04dae3e441d2fc8245491c7bf2a898560d2": {
		functionName: "updateCompanyMemberRole_createServerFn_handler",
		importer: () => import("./_ssr/company.functions-RR6ReucV.mjs")
	},
	"94da999a0933054ab3cb74966387ad16f3a281416af63d7e9ac3a28159613010": {
		functionName: "addCompanyMemberByDiscord_createServerFn_handler",
		importer: () => import("./_ssr/company.functions-RR6ReucV.mjs")
	},
	"a0ab5e30f64119bee4f78e74fdf5da4ee035e14916671c29321c5572f20aa97c": {
		functionName: "verifyInternalAccess_createServerFn_handler",
		importer: () => import("./_ssr/auth.functions-B1FedOFo.mjs")
	},
	"acc17047ceb58a5b4f30bbc64e7142cda91c5f3d79fee7a7b7e02cdc0c51f0dc": {
		functionName: "fetchInternalCompaniesFromDb_createServerFn_handler",
		importer: () => import("./_ssr/company.functions-RR6ReucV.mjs")
	},
	"b86d649c66031958ae6b071efbe36c2f7d46ca9e5b489c0e2a8f7a658cd2df2c": {
		functionName: "removeCompanyMember_createServerFn_handler",
		importer: () => import("./_ssr/company.functions-RR6ReucV.mjs")
	},
	"cd298f43baf09dc17f99eb5d3c8ffde6b58b3a6d28edb4328d90b16eb823af6a": {
		functionName: "fetchInternalCompanyFromDb_createServerFn_handler",
		importer: () => import("./_ssr/company.functions-RR6ReucV.mjs")
	},
	"dd3ed99373b3a6b76ccc48e4f2a4a029f59b0f16ee4f3432914fda53bc2ab926": {
		functionName: "createCompanyRecord_createServerFn_handler",
		importer: () => import("./_ssr/company.functions-RR6ReucV.mjs")
	},
	"e3a1afeeb5f28724385453bb7804867542865c37b25db4bd251663f6d4b76053": {
		functionName: "verifyPrivateClientAccess_createServerFn_handler",
		importer: () => import("./_ssr/auth.functions-B1FedOFo.mjs")
	},
	"f4d0bd53681593619da24fb073b3d7cdfc7d282fb71f629d8516af0b22f589e7": {
		functionName: "verifyDeveloperAccess_createServerFn_handler",
		importer: () => import("./_ssr/auth.functions-B1FedOFo.mjs")
	},
	"f795d772db490916d5764375eb1c4d2bbe928df6b1a777629454179e22d03bfe": {
		functionName: "updateCompanySettingsRecord_createServerFn_handler",
		importer: () => import("./_ssr/company.functions-RR6ReucV.mjs")
	}
};
async function getServerFnById(id, access) {
	const serverFnInfo = manifest[id];
	if (!serverFnInfo) throw new Error("Server function info not found for " + id);
	const fnModule = serverFnInfo.module ?? await serverFnInfo.importer();
	if (!fnModule) throw new Error("Server function module not resolved for " + id);
	const action = fnModule[serverFnInfo.functionName];
	if (!action) throw new Error("Server function module export not resolved for serverFn ID: " + id);
	return action;
}
//#endregion
export { getServerFnById as t };
