import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { a as Section, i as PageShell, r as Card } from "./page-shell-B0Lrv62S.mjs";
import { n as florin } from "./mock-data-BOQymobG.mjs";
import { f as getTransferHistory } from "./api-BMHYd9JH.mjs";
import { t as BankSubNav } from "./bank-sub-nav-4JcDc0gI.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/transfers-B3mtfgVa.js
var import_jsx_runtime = require_jsx_runtime();
var fields = [
	{
		label: "From account",
		placeholder: "Alta Checking ••1187"
	},
	{
		label: "Recipient institution",
		placeholder: "Meridian Holdings LLP"
	},
	{
		label: "Recipient name",
		placeholder: "Treasury Operations"
	},
	{
		label: "Routing number",
		placeholder: "021000021"
	},
	{
		label: "Account number",
		placeholder: "•••• •••• 4821"
	},
	{
		label: "Settlement network",
		placeholder: "NCC-Net",
		value: "NCC-Net"
	},
	{
		label: "Amount",
		placeholder: "ƒ0.00"
	},
	{
		label: "Memo",
		placeholder: "Operating disbursement"
	}
];
function TransferFormPreview() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground",
			children: "Wire Transfer · NCC-Net"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 text-[13px] text-muted-foreground",
			children: "Outbound wires route through NCC-Net settlement infrastructure — planned clearing network for Newport interbank transfers."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-6 grid gap-4 md:grid-cols-2",
			children: fields.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "block",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
					children: f.label
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "text",
					readOnly: true,
					value: f.value,
					placeholder: f.placeholder,
					className: "mt-2 w-full cursor-not-allowed rounded-md border border-border bg-surface-2/50 px-3 py-2 text-sm text-muted-foreground"
				})]
			}, f.label))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-6 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground",
			children: "Wire execution is simulated in this preview. NCC-Net settlement is planned infrastructure."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			disabled: true,
			className: "mt-4 cursor-not-allowed rounded-md border border-border bg-surface-2 px-5 py-2.5 text-[13px] font-medium text-muted-foreground",
			children: "Submit wire (preview only)"
		})
	] });
}
function BankTransfers() {
	const transferHistory = getTransferHistory();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Bank · Transfers",
		title: "Transfers & Wires",
		description: "Move funds across Alta accounts or initiate outbound wires via NCC-Net — preview interface only.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BankSubNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-6 lg:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "Internal Transfer",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[13px] leading-relaxed text-muted-foreground",
						children: "Move funds between Alta Checking, Savings, Reserve, and Business accounts — instant settlement within Alta Bank."
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-4 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-[13px] text-muted-foreground",
						children: "Transfer execution is simulated in this preview."
					})] })
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "Scheduled Transfers",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "space-y-3 text-sm",
						children: transferHistory.filter((t) => t.status === "Scheduled").map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex justify-between border-b border-border/50 pb-3 last:border-0",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t.to }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "tabular font-mono",
								children: florin(t.amount)
							})]
						}, t.id))
					}) })
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Wire Transfer · NCC-Net",
				className: "mt-10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TransferFormPreview, {})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Transfer History",
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
									children: "Date"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-5 py-3",
									children: "Type"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-5 py-3",
									children: "From"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-5 py-3",
									children: "To"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-5 py-3",
									children: "Settlement"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-5 py-3 text-right",
									children: "Amount"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-5 py-3",
									children: "Status"
								})
							]
						}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: transferHistory.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-border/50 last:border-0 hover:bg-surface-2/40",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-5 py-3 font-mono text-[12px] text-muted-foreground",
									children: t.date
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-5 py-3",
									children: t.type
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-5 py-3 text-muted-foreground",
									children: t.from
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-5 py-3",
									children: t.to
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-5 py-3 font-mono text-[11px] text-muted-foreground",
									children: t.settlement ?? "—"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "tabular px-5 py-3 text-right",
									children: florin(t.amount)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-5 py-3 font-mono text-[11px]",
									children: t.status
								})
							]
						}, t.id)) })]
					})
				})
			})
		]
	});
}
//#endregion
export { BankTransfers as component };
