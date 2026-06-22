import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { a as Area, r as YAxis, t as AreaChart, u as ResponsiveContainer } from "../_libs/recharts+victory-vendor.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/mini-chart-D2f8DI-l.js
var import_jsx_runtime = require_jsx_runtime();
function MiniChart({ data, positive = true, height = 56 }) {
	const color = positive ? "var(--success)" : "var(--danger)";
	const id = `g-${positive ? "u" : "d"}-${Math.random().toString(36).slice(2, 7)}`;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
		width: "100%",
		height,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AreaChart, {
			data,
			margin: {
				top: 4,
				right: 0,
				bottom: 0,
				left: 0
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", {
					id,
					x1: "0",
					x2: "0",
					y1: "0",
					y2: "1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
						offset: "0%",
						stopColor: color,
						stopOpacity: .35
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
						offset: "100%",
						stopColor: color,
						stopOpacity: 0
					})]
				}) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, {
					hide: true,
					domain: ["dataMin", "dataMax"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Area, {
					type: "monotone",
					dataKey: "v",
					stroke: color,
					strokeWidth: 1.6,
					fill: `url(#${id})`,
					isAnimationActive: false
				})
			]
		})
	});
}
//#endregion
export { MiniChart as t };
