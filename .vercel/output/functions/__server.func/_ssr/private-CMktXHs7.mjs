import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { n as PageShell, r as Section } from "./page-shell-ZY9JEvww.mjs";
import { r as getAdminPrivateQueue } from "./api-f6-s6LjW.mjs";
import { t as BankSubNav } from "./bank-sub-nav-Ds51rrCr.mjs";
import { t as AdminQueueTable } from "./admin-queue-table-Br3s7qMv.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/private-CMktXHs7.js
var import_jsx_runtime = require_jsx_runtime();
function AdminPrivate() {
	const adminPrivateQueue = getAdminPrivateQueue();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Bank · Relationship Manager",
		title: "Private Invitations",
		description: "Review Alta Private invitation requests — simulated admin preview.",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BankSubNav, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
			title: "Invitation Queue",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminQueueTable, {
				title: "Pending Invitations",
				rows: adminPrivateQueue.map((p) => ({
					id: p.id,
					primary: p.name,
					secondary: `Submitted ${p.submitted}`,
					amount: p.balance,
					status: p.status
				})),
				showActions: true
			})
		})]
	});
}
//#endregion
export { AdminPrivate as component };
