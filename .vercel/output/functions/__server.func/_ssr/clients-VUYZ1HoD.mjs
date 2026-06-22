import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { n as PageShell, r as Section } from "./page-shell-ZY9JEvww.mjs";
import { t as getAdminClients } from "./api-f6-s6LjW.mjs";
import { t as BankSubNav } from "./bank-sub-nav-Ds51rrCr.mjs";
import { t as AdminQueueTable } from "./admin-queue-table-Br3s7qMv.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/clients-VUYZ1HoD.js
var import_jsx_runtime = require_jsx_runtime();
function AdminClients() {
	const adminClients = getAdminClients();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Bank · Relationship Manager",
		title: "Client Management",
		description: "Relationship banking admin preview — all actions are simulated.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BankSubNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Client Search",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "search",
					placeholder: "Search clients by name, ID, or account…",
					className: "w-full max-w-md rounded-md border border-border bg-surface-1 px-4 py-2.5 text-sm outline-none focus:border-gold/50",
					disabled: true
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Client Queue",
				className: "mt-8",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminQueueTable, {
					title: "Active Relationships",
					rows: adminClients.map((c) => ({
						id: c.id,
						primary: c.name,
						secondary: `${c.tier} · Private: ${c.privateInvite}`,
						amount: c.relationshipValue,
						status: c.accountStatus
					})),
					showActions: true
				})
			})
		]
	});
}
//#endregion
export { AdminClients as component };
