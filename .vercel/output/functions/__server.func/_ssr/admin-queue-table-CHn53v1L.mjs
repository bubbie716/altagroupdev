import { n as florin } from "./mock-data-BOQymobG.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { t as Card } from "./page-shell-Czj8D5TM.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin-queue-table-CHn53v1L.js
var import_jsx_runtime = require_jsx_runtime();
function AdminQueueTable({ title, rows, showActions = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
		className: "!p-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "border-b border-border px-5 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
			children: title
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
			className: "w-full text-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
				className: "border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3",
						children: "ID"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3",
						children: "Client"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3",
						children: "Detail"
					}),
					rows.some((r) => r.amount != null) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3 text-right",
						children: "Amount"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3",
						children: "Status"
					}),
					showActions && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
						className: "px-5 py-3 text-right",
						children: "Actions"
					})
				]
			}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: rows.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
				className: "border-b border-border/50 last:border-0",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-5 py-3 font-mono text-[12px] text-muted-foreground",
						children: r.id
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-5 py-3 font-medium",
						children: r.primary
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-5 py-3 text-muted-foreground",
						children: r.secondary
					}),
					rows.some((x) => x.amount != null) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "tabular px-5 py-3 text-right",
						children: r.amount != null ? florin(r.amount) : "—"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-5 py-3 font-mono text-[11px]",
						children: r.status
					}),
					showActions && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
						className: "px-5 py-3 text-right",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex justify-end gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "rounded border border-[var(--success)]/30 px-2 py-1 font-mono text-[10px] text-[var(--success)]",
									children: "Approve"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "rounded border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground",
									children: "Deny"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									className: "rounded border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground",
									children: "Freeze"
								})
							]
						})
					})
				]
			}, r.id)) })]
		})]
	});
}
//#endregion
export { AdminQueueTable as t };
