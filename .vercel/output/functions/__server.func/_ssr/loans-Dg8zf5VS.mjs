import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { n as PageShell, r as Section } from "./page-shell-ZY9JEvww.mjs";
import { n as getAdminLoanQueue } from "./api-f6-s6LjW.mjs";
import { t as BankSubNav } from "./bank-sub-nav-Ds51rrCr.mjs";
import { t as AdminQueueTable } from "./admin-queue-table-Br3s7qMv.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/loans-Dg8zf5VS.js
var import_jsx_runtime = require_jsx_runtime();
function AdminLoans() {
	const adminLoanQueue = getAdminLoanQueue();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Bank · Relationship Manager",
		title: "Loan Review Queue",
		description: "Underwriting review queue — simulated admin preview.",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BankSubNav, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
			title: "Pending Applications",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminQueueTable, {
				title: "Loan Applications",
				rows: adminLoanQueue.map((l) => ({
					id: l.id,
					primary: l.client,
					secondary: l.product,
					amount: l.amount,
					status: l.status
				})),
				showActions: true
			})
		})]
	});
}
//#endregion
export { AdminLoans as component };
