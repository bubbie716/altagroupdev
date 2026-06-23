import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { a as Section, i as PageShell, r as Card } from "./page-shell-B0Lrv62S.mjs";
import { n as florin } from "./mock-data-BOQymobG.mjs";
import { p as getTradeDefaults, r as getOrders } from "./api-q9xPrXz_.mjs";
import { t as TerminalSubNav } from "./terminal-sub-nav-CN6tJP6E.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/trade-BVfXA2Fy.js
var import_jsx_runtime = require_jsx_runtime();
function TradeTicket() {
	const t = getTradeDefaults();
	const cost = t.quantity * t.estimatedPrice;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground",
			children: "Order Ticket"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-6 grid gap-4 md:grid-cols-2",
			children: [
				{
					label: "Ticker",
					value: t.ticker,
					placeholder: "Enter symbol"
				},
				{
					label: "Side",
					value: t.side
				},
				{
					label: "Order type",
					value: t.orderType
				},
				{
					label: "Quantity",
					value: String(t.quantity)
				},
				{
					label: "Estimated price",
					value: florin(t.estimatedPrice)
				},
				{
					label: "Estimated cost",
					value: florin(cost)
				},
				{
					label: "Available cash",
					value: florin(t.availableCash)
				}
			].map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "block",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
					children: f.label
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "text",
					readOnly: true,
					defaultValue: f.value,
					placeholder: "placeholder" in f ? f.placeholder : void 0,
					className: "mt-2 w-full cursor-not-allowed rounded-md border border-border bg-surface-2/50 px-3 py-2 text-sm text-muted-foreground shadow-none"
				})]
			}, f.label))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-6 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground",
			children: "Order entry is simulated in this preview. No trades are executed."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mt-4 flex flex-wrap gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				disabled: true,
				className: "cursor-not-allowed rounded-md border border-border bg-surface-2 px-5 py-2.5 text-[13px] font-medium text-muted-foreground",
				children: "Review Order (preview only)"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				disabled: true,
				className: "cursor-not-allowed rounded-md bg-foreground/40 px-5 py-2.5 text-[13px] font-medium text-background/70",
				children: "Submit Order (preview only)"
			})]
		})
	] });
}
function TerminalTrade() {
	const orders = getOrders();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Terminal · Trade",
		title: "Trade Ticket",
		description: "Prepare simulated buy and sell orders on Alta Exchange — no execution in this preview.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TerminalSubNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TradeTicket, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Recent Orders",
				className: "mt-10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					className: "!p-0",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "w-full text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-5 py-3",
									children: "Order"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-5 py-3",
									children: "Side"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-5 py-3",
									children: "Symbol"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-5 py-3 text-right",
									children: "Qty"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-5 py-3 text-right",
									children: "Price"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-5 py-3",
									children: "Status"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-5 py-3 text-right",
									children: "Time"
								})
							]
						}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: orders.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-border/50 last:border-0",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-5 py-3 font-mono text-[12px] text-muted-foreground",
									children: o.id
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: `px-5 py-3 font-mono text-[12px] ${o.side === "BUY" ? "ticker-up" : "ticker-down"}`,
									children: o.side
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-5 py-3 font-mono",
									children: o.symbol
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "tabular px-5 py-3 text-right",
									children: o.qty
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "tabular px-5 py-3 text-right",
									children: o.price.toFixed(2)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-5 py-3 font-mono text-[11px]",
									children: o.status
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "tabular px-5 py-3 text-right font-mono text-[11px] text-muted-foreground",
									children: o.time
								})
							]
						}, o.id)) })]
					})
				})
			})
		]
	});
}
//#endregion
export { TerminalTrade as component };
