import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { r as Card } from "./page-shell-B0Lrv62S.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin-data-table-ChY-n6-o.js
var import_jsx_runtime = require_jsx_runtime();
function AdminDataTable({ columns, rows, rowKey }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
		className: "!p-0 overflow-x-auto",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
			className: "w-full min-w-[640px] text-sm",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
				className: "border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground",
				children: columns.map((col) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
					className: `px-4 py-3 ${col.className ?? ""}`,
					children: col.header
				}, col.key))
			}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: rows.map((row, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tr", {
				className: "border-b border-border/50 last:border-0 hover:bg-surface-2/40",
				children: columns.map((col) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
					className: `px-4 py-3 ${col.className ?? ""}`,
					children: col.cell(row)
				}, col.key))
			}, rowKey?.(row, i) ?? row.id ?? i)) })]
		})
	});
}
//#endregion
export { AdminDataTable as t };
