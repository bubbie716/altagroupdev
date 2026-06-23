import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { t as motion } from "../_libs/framer-motion.mjs";
import { _ as ArrowUpRight } from "../_libs/lucide-react.mjs";
import { a as Section, i as PageShell, r as Card } from "./page-shell-B0Lrv62S.mjs";
import { c as getMarketingSections, r as getBankDescription } from "./api-BMHYd9JH.mjs";
import { t as BankSubNav } from "./bank-sub-nav-4JcDc0gI.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/bank-DxtC7vWX.js
var import_jsx_runtime = require_jsx_runtime();
function BankHome() {
	const bankDescription = getBankDescription();
	const bankMarketingSections = getMarketingSections();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Bank",
		title: "Bank Like the 1%",
		description: bankDescription,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BankSubNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2 lg:grid-cols-3",
				children: bankMarketingSections.map((s, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: s.to,
					className: "group flex flex-col bg-surface-1 p-7 transition-colors hover:bg-surface-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(motion.div, {
						initial: {
							opacity: 0,
							y: 12
						},
						whileInView: {
							opacity: 1,
							y: 0
						},
						viewport: { once: true },
						transition: {
							duration: .5,
							delay: i * .06
						},
						className: "flex h-full flex-col",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
									children: "Alta Bank"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpRight, { className: "h-4 w-4 text-muted-foreground transition-all group-hover:text-gold" })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "mt-8 text-xl font-semibold tracking-tight",
								children: s.title
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-3 flex-1 text-[13.5px] leading-relaxed text-muted-foreground",
								children: s.desc
							})
						]
					})
				}, s.title))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Open an Account",
				className: "mt-16",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-lg font-semibold tracking-tight",
						children: "New to Newport? Start with Alta Access."
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 max-w-xl text-[14px] leading-relaxed text-muted-foreground",
						children: "Alta Bank is Newport's full-service financial institution — open to citizens, businesses, and institutions. New citizens begin with Alta Access; established clients upgrade to Alta Checking, Reserve, and beyond."
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex shrink-0 flex-col gap-2 sm:flex-row",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/bank/deposits",
							className: "rounded-md border border-border px-5 py-3 text-center text-[13px] font-medium tracking-wide",
							children: "View Deposits"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/bank/dashboard",
							className: "rounded-md bg-foreground px-5 py-3 text-center text-[13px] font-medium tracking-wide text-background",
							children: "Financial Position"
						})]
					})]
				})
			})
		]
	});
}
//#endregion
export { BankHome as component };
