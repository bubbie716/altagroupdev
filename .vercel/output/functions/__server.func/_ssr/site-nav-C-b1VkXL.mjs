import { g as Link, l as useRouterState } from "../_libs/@tanstack/react-router+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { r as useTheme } from "./theme-BzKNVI64.mjs";
import { t as clsx } from "../_libs/clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { n as Moon, t as Sun } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/site-nav-C-b1VkXL.js
var import_jsx_runtime = require_jsx_runtime();
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
/**
* Alta mark — stylised "A": triangular outline with an arc base.
* Pure SVG, inherits currentColor.
*/
function AltaLogo({ className, variant = "default" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		viewBox: "0 0 100 100",
		fill: "none",
		xmlns: "http://www.w3.org/2000/svg",
		className: cn("h-6 w-6", variant === "gold" ? "text-[var(--gold)]" : variant === "white" ? "text-white" : "text-foreground", className),
		"aria-hidden": "true",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M50 14 L84 84",
				stroke: "currentColor",
				strokeWidth: "9",
				strokeLinecap: "round"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M50 14 L16 84",
				stroke: "currentColor",
				strokeWidth: "9",
				strokeLinecap: "round"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M20 80 Q50 60 80 80",
				stroke: "currentColor",
				strokeWidth: "9",
				strokeLinecap: "round",
				fill: "none"
			})
		]
	});
}
function AltaWordmark({ className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: cn("flex items-center gap-2.5", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AltaLogo, { className: "h-7 w-7" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-[15px] font-semibold tracking-[0.18em] text-foreground",
			children: "ALTA"
		})]
	});
}
var links = [
	{
		to: "/",
		label: "Overview"
	},
	{
		to: "/bank/dashboard",
		label: "Alta Bank",
		match: "/bank"
	},
	{
		to: "/terminal",
		label: "Alta Terminal"
	},
	{
		to: "/exchange",
		label: "Alta Exchange"
	},
	{
		to: "/governance",
		label: "About"
	}
];
function SiteNav() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const { theme, toggle } = useTheme();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
		className: "sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/",
					className: "flex items-center",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AltaWordmark, {})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
					className: "hidden items-center gap-1 md:flex",
					children: links.map((l) => {
						const active = l.to === "/" ? pathname === "/" : "match" in l ? pathname.startsWith(l.match) : pathname.startsWith(l.to);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: l.to,
							className: cn("relative rounded-md px-3 py-1.5 text-[13px] tracking-wide text-muted-foreground transition-colors duration-200 hover:text-foreground", active && "text-foreground after:absolute after:inset-x-2.5 after:-bottom-[17px] after:h-[2px] after:rounded-full after:bg-gold"),
							children: l.label
						}, l.to);
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "hidden items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground lg:inline-flex",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "inline-block size-1.5 rounded-full bg-[var(--success)] shadow-[0_0_8px_var(--success)]" }), "Alta Exchange • Open"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							onClick: toggle,
							"aria-label": "Toggle theme",
							className: "rounded-md border border-border bg-surface-2/60 p-2 text-muted-foreground transition-colors hover:text-foreground hover:border-border-strong",
							children: theme === "dark" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sun, { className: "size-3.5" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Moon, { className: "size-3.5" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/terminal",
							className: "rounded-md border border-border-strong bg-surface-2 px-3.5 py-1.5 text-[12px] font-medium tracking-wide text-foreground transition-colors hover:bg-[color:var(--surface-2)]/70",
							children: "Enter Platform"
						})
					]
				})
			]
		})
	});
}
function SiteFooter() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
		className: "border-t border-border/60 mt-32",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mx-auto max-w-[1400px] px-6 py-16",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-12 md:grid-cols-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "md:col-span-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AltaWordmark, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-4 max-w-xs text-sm text-muted-foreground",
						children: "Live Like the 1%"
					})]
				}), [
					{
						title: "Divisions",
						items: [
							"Alta Bank",
							"Alta Terminal",
							"Alta Exchange",
							"NCC"
						]
					},
					{
						title: "Platform",
						items: [
							"Alta Terminal",
							"Alta Exchange",
							"Research",
							"API"
						]
					},
					{
						title: "Company",
						items: [
							"About",
							"Governance",
							"Press",
							"Careers"
						]
					}
				].map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground",
					children: c.title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-4 space-y-2 text-sm text-foreground/90",
					children: c.items.map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "hover:text-gold transition-colors cursor-default",
						children: i
					}, i))
				})] }, c.title))]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-16 flex flex-col items-start justify-between gap-3 border-t border-border/60 pt-6 md:flex-row md:items-center",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground",
					children: "© 2026 Alta Group N.V. — Newport, ND · Florin-denominated · Settlement T+0"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[11px] text-muted-foreground",
					children: "Simulated Newport financial infrastructure."
				})]
			})]
		})
	});
}
//#endregion
export { cn as a, SiteNav as i, AltaWordmark as n, SiteFooter as r, AltaLogo as t };
