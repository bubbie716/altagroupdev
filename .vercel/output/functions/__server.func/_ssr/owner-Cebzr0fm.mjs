import { o as __toESM } from "../_runtime.mjs";
import { r as findCompanyMembership } from "./permissions-DFFnJwMM.mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { c as cn, i as PageShell, l as useCurrentUser, r as Card } from "./page-shell-B0Lrv62S.mjs";
import { n as getCompany } from "./companies-D1cM1agJ.mjs";
import { t as ExchangeSubNav } from "./exchange-sub-nav-C-Bh7K80.mjs";
import { a as SelectValue, i as SelectTrigger, n as SelectContent, r as SelectItem, t as Select } from "./select-BdS1UEsc.mjs";
import { t as Textarea } from "./textarea-0kbnk8py.mjs";
import { t as Route } from "./owner-DmpqlVOr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/owner-Cebzr0fm.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var fieldClass = "mt-2 w-full cursor-not-allowed rounded-md border border-border bg-surface-2/50 px-3 py-2 text-sm text-muted-foreground shadow-none";
var previewPrimaryButtonClass = "cursor-not-allowed rounded-md bg-foreground/40 px-5 py-2.5 text-[13px] font-medium text-background/70";
var monthOptions = [
	"June 2026",
	"May 2026",
	"April 2026",
	"March 2026"
];
function UploadPlaceholder({ label }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-md border border-dashed border-border bg-surface-2/30 px-4 py-8 text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-2 text-[12px] text-muted-foreground",
				children: "Drag and drop or browse — preview only"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				disabled: true,
				className: "mt-4 cursor-not-allowed rounded border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground",
				children: "Choose file"
			})
		]
	});
}
function IssuerPortalPanel({ company, session, onSignOut }) {
	const [tab, setTab] = (0, import_react.useState)("announcement");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto w-full max-w-2xl",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "mb-8 flex flex-wrap items-center justify-between gap-4 border-gold/30 bg-gold/5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
					children: ["Issuer portal · ", company.symbol]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-1 font-medium",
					children: session.organization
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/exchange/company/$ticker",
						params: { ticker: company.symbol.toLowerCase() },
						className: "font-mono text-[11px] uppercase tracking-[0.16em] text-gold hover:underline",
						children: "View public profile →"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onSignOut,
						className: "rounded-md border border-border px-4 py-2 text-[13px] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground",
						children: "Sign out"
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mb-6 flex justify-center gap-1 border-b border-border/60 pb-4",
				children: [{
					id: "announcement",
					label: "Corporate announcement"
				}, {
					id: "financial",
					label: "Monthly financial update"
				}].map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setTab(t.id),
					className: cn("rounded-md px-3 py-1.5 text-[12px] tracking-wide transition-colors", tab === t.id ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground"),
					children: t.label
				}, t.id))
			}),
			tab === "announcement" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
							children: "Announcement title"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "text",
							readOnly: true,
							placeholder: "Headline visible on your ticker page",
							className: fieldClass
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
							children: "Announcement body"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							readOnly: true,
							placeholder: "Full announcement text for investors and market participants…",
							className: cn(fieldClass, "min-h-[6rem] resize-none focus-visible:ring-0")
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UploadPlaceholder, { label: "Supporting document (optional)" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
						className: "border-gold/30 bg-gold/5 !p-4",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[13px] leading-relaxed text-muted-foreground",
							children: "Announcements are published to your Alta Exchange ticker page after review. Submission is simulated in this preview."
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						disabled: true,
						className: previewPrimaryButtonClass,
						children: "Publish announcement (preview only)"
					})
				]
			}) }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "block",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
							children: "Reporting period"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
							disabled: true,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
								className: cn(fieldClass, "h-auto min-h-10 disabled:cursor-not-allowed disabled:opacity-100 [&>svg]:text-muted-foreground [&>svg]:opacity-50"),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder: "Select month" })
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: monthOptions.map((month) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
								value: month.toLowerCase().replace(/\s+/g, "-"),
								children: month
							}, month)) })]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UploadPlaceholder, { label: "Monthly financial update (PDF)" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
							children: "Summary note"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							readOnly: true,
							placeholder: "Brief summary accompanying the monthly financial update…",
							className: cn(fieldClass, "min-h-[4.5rem] resize-none focus-visible:ring-0")
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
						className: "border-gold/30 bg-gold/5 !p-4",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[13px] leading-relaxed text-muted-foreground",
							children: "Monthly financial updates are filed to your ticker page and indexed in Alta Exchange research. Upload is simulated in this preview."
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						disabled: true,
						className: previewPrimaryButtonClass,
						children: "Submit financial update (preview only)"
					})
				]
			}) })
		]
	});
}
function CompanyOwnerPage() {
	const { ticker } = Route.useParams();
	const user = useCurrentUser();
	const company = getCompany(ticker);
	if (!company) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Exchange",
		title: "Company Not Found",
		description: "No listing found for this ticker.",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExchangeSubNav, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-muted-foreground",
			children: "Ticker not found in Alta Exchange listings."
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/exchange/listings",
			className: "mt-4 inline-block font-mono text-[11px] uppercase tracking-[0.18em] text-gold",
			children: "← Back to listings"
		})] })]
	});
	if (!user) return null;
	const membership = findCompanyMembership(user, { ticker });
	const session = {
		ticker: company.symbol,
		organization: membership?.companyName ?? company.name
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: `Alta Exchange · Issuer Portal · ${company.symbol}`,
		title: `${company.name} — Owner Portal`,
		description: "Publish corporate announcements and monthly financial updates to your Alta Exchange ticker page.",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExchangeSubNav, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex justify-center",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IssuerPortalPanel, {
				company,
				session,
				onSignOut: () => {}
			})
		})]
	});
}
//#endregion
export { CompanyOwnerPage as component };
