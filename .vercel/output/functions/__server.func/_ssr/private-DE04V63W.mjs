import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { n as PageShell, r as Section, t as Card } from "./page-shell-ZY9JEvww.mjs";
import { f as getPrivateBanking, p as getPrivateMetrics } from "./api-f6-s6LjW.mjs";
import { t as BankSubNav } from "./bank-sub-nav-Ds51rrCr.mjs";
import { t as BankStatCard } from "./bank-stat-card-DuVS5g-b.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/private-DE04V63W.js
var import_jsx_runtime = require_jsx_runtime();
function PrivateTierCard({ label, value, detail }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
			children: label
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-3 text-lg font-semibold tracking-tight",
			children: value
		}),
		detail && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 text-[13px] leading-relaxed text-muted-foreground",
			children: detail
		})
	] });
}
function PrivateMetalCardMock() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative aspect-[1.586/1] w-full max-w-[340px] overflow-hidden rounded-xl shadow-card ring-1 ring-white/[0.08]",
		style: { background: "linear-gradient(145deg, #0c1018 0%, #060810 55%, #0a0e17 100%)" },
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(255,255,255,0.06),transparent_50%)]" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative flex h-full flex-col justify-between p-7",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "font-mono text-[10px] uppercase tracking-[0.32em] text-white/45",
					children: "Alta Private"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "font-mono text-[13px] uppercase tracking-[0.28em] text-white/90",
					children: "Alta Private"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-1 font-mono text-[10px] uppercase tracking-[0.24em] text-white/50",
					children: "Metal Card"
				})] }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "font-mono text-[11px] uppercase tracking-[0.2em] text-white/35",
					children: "Cardholder"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-1 text-[14px] font-medium tracking-wide text-white/85",
					children: "Whitford Family Office"
				})] })
			]
		})]
	});
}
function BankPrivate() {
	const p = getPrivateBanking();
	const privateMetrics = getPrivateMetrics();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Bank · Private",
		title: "Invitation Only",
		description: "Alta Private is invitation-only private banking within Alta Bank, reserved for Newport's most influential individuals, founders, institutions, and high-balance clients.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BankSubNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-4 md:grid-cols-2 lg:grid-cols-4",
				children: privateMetrics.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BankStatCard, {
					label: m.label,
					value: m.value
				}, m.label))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-10 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-start",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "border-gold/20 bg-surface-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-mono text-[11px] uppercase tracking-[0.24em] text-gold",
							children: "Alta Private"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground",
							children: "Alta Private is invitation-only private banking within Alta Bank, reserved for Newport's most influential individuals, founders, institutions, and high-balance clients. Membership is extended by referral — not open for public application."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-6 inline-flex rounded-full border border-border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground",
							children: "Applications closed — access extended by invitation only"
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrivateMetalCardMock, {})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrivateTierCard, {
						label: "Private Banker",
						value: p.banker,
						detail: p.bankerTitle
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrivateTierCard, {
						label: "Relationship Tier",
						value: p.tier
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrivateTierCard, {
						label: "Private Card",
						value: p.card,
						detail: p.cardLimit
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrivateTierCard, {
						label: "Priority Lending",
						value: p.lending
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrivateTierCard, {
						label: "Private Negotiated CDs",
						value: "Active placements",
						detail: p.cds
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrivateTierCard, {
						label: "Liquidity Line",
						value: p.liquidityLine
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrivateTierCard, {
						label: "Invitation-Only Access",
						value: "By referral",
						detail: "Not open for public application"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Private Benefits",
				className: "mt-12",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2",
					children: [
						"Dedicated private banker",
						"Same-day NCC-Net wire priority",
						"Negotiated deposit terms",
						"Standby liquidity facilities",
						"Concierge settlement support",
						"Integrated Alta Terminal access"
					].map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "bg-surface-1 px-6 py-4 text-[14px]",
						children: item
					}, item))
				})
			})
		]
	});
}
//#endregion
export { BankPrivate as component };
