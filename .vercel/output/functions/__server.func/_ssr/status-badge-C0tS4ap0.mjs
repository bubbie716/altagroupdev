import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { c as cn } from "./page-shell-B0Lrv62S.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/status-badge-C0tS4ap0.js
var import_jsx_runtime = require_jsx_runtime();
var statusStyles = {
	Active: "bg-[var(--success)]/10 text-[var(--success)]",
	Operational: "bg-[var(--success)]/10 text-[var(--success)]",
	Open: "bg-[var(--success)]/10 text-[var(--success)]",
	Listed: "bg-[var(--success)]/10 text-[var(--success)]",
	Cleared: "bg-[var(--success)]/10 text-[var(--success)]",
	Verified: "bg-[var(--success)]/10 text-[var(--success)]",
	Authorized: "bg-[var(--success)]/10 text-[var(--success)]",
	Complete: "bg-[var(--success)]/10 text-[var(--success)]",
	Approved: "bg-[var(--success)]/10 text-[var(--success)]",
	Posted: "bg-[var(--success)]/10 text-[var(--success)]",
	Deposit: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
	Withdrawal: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
	"Not Required": "bg-muted text-muted-foreground",
	Unverified: "bg-muted text-muted-foreground",
	Partial: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
	"Pending Review": "bg-amber-500/10 text-amber-700 dark:text-amber-400",
	Missing: "bg-[var(--destructive)]/10 text-[var(--destructive)]",
	Revoked: "bg-[var(--destructive)]/10 text-[var(--destructive)]",
	None: "bg-muted text-muted-foreground",
	Working: "bg-gold/10 text-gold",
	Review: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
	"Under Review": "bg-amber-500/10 text-amber-700 dark:text-amber-400",
	Assigned: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
	Pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
	New: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
	Degraded: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
	Halted: "bg-[var(--destructive)]/10 text-[var(--destructive)]",
	Frozen: "bg-[var(--destructive)]/10 text-[var(--destructive)]",
	Suspended: "bg-[var(--destructive)]/10 text-[var(--destructive)]",
	Rejected: "bg-[var(--destructive)]/10 text-[var(--destructive)]",
	Escalated: "bg-[var(--destructive)]/10 text-[var(--destructive)]",
	Flagged: "bg-[var(--destructive)]/10 text-[var(--destructive)]",
	"Needs Info": "bg-muted text-muted-foreground",
	Resolved: "bg-muted text-muted-foreground",
	Maintenance: "bg-muted text-muted-foreground"
};
function StatusBadge({ status }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-flex rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]", statusStyles[status] ?? "bg-surface-2 text-muted-foreground"),
		children: status
	});
}
//#endregion
export { StatusBadge as t };
