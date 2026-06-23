import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { i as PageShell, r as Card } from "./page-shell-B0Lrv62S.mjs";
import { t as ExchangeSubNav } from "./exchange-sub-nav-C-Bh7K80.mjs";
import { a as SelectValue, i as SelectTrigger, n as SelectContent, r as SelectItem, t as Select } from "./select-BdS1UEsc.mjs";
import { t as Textarea } from "./textarea-0kbnk8py.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/apply-CkitHcXo.js
var import_jsx_runtime = require_jsx_runtime();
var previewFieldClass = "mt-2 w-full cursor-not-allowed rounded-md border border-border bg-surface-2/50 px-3 py-2 text-sm text-muted-foreground shadow-none";
function toSelectValue(option) {
	return option.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}
function PreviewSelect({ label, placeholder, options }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "block",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
			disabled: true,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
				className: `${previewFieldClass} h-auto min-h-10 disabled:cursor-not-allowed disabled:opacity-100 [&>svg]:text-muted-foreground [&>svg]:opacity-50`,
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, { placeholder })
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: options.map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
				value: toSelectValue(option),
				children: option
			}, option)) })]
		})]
	});
}
function FormField({ field }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
		className: field.span === 2 ? "block md:col-span-2" : "block",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground",
			children: field.label
		}), field.type === "textarea" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
			autoResize: true,
			placeholder: field.placeholder,
			className: `${previewFieldClass} min-h-[4.5rem] focus-visible:ring-0`
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
			type: "text",
			readOnly: true,
			placeholder: field.placeholder,
			className: previewFieldClass
		})]
	});
}
function FormSection({ title, fields }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground",
		children: title
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mt-6 grid gap-4 md:grid-cols-2",
		children: fields.map((f) => f.type === "select" && f.options ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PreviewSelect, {
			label: f.label,
			placeholder: f.placeholder,
			options: f.options
		}, f.label) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FormField, { field: f }, f.label))
	})] });
}
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
var companyFields = [
	{
		label: "Company name",
		placeholder: "Harbor Logistics Group"
	},
	{
		label: "Desired ticker",
		placeholder: "HLOG"
	},
	{
		label: "Sector",
		placeholder: "Select sector",
		type: "select",
		options: [
			"Energy",
			"Financials",
			"Industrials",
			"Healthcare",
			"Consumer",
			"Materials",
			"Utilities",
			"Telecom"
		]
	},
	{
		label: "Founder / CEO",
		placeholder: "Full name"
	},
	{
		label: "Headquarters",
		placeholder: "Newport Harbor District"
	},
	{
		label: "Company description",
		placeholder: "Brief description of the business, operations, and market position…",
		type: "textarea",
		span: 2
	}
];
var financialFields = [
	{
		label: "Estimated company value",
		placeholder: "ƒ500M"
	},
	{
		label: "Shares to issue",
		placeholder: "5,000,000"
	},
	{
		label: "Proposed offering price",
		placeholder: "ƒ18.00"
	},
	{
		label: "Intended raise size",
		placeholder: "ƒ90M"
	},
	{
		label: "Current revenue / income estimate",
		placeholder: "ƒ42M annual revenue"
	},
	{
		label: "Existing shareholders",
		placeholder: "Founder 68%, Family Office 22%, Employee pool 10%",
		type: "textarea",
		span: 2
	}
];
var listingFields = [
	{
		label: "Reason for listing",
		placeholder: "Capital raise, liquidity, institutional visibility…",
		type: "textarea",
		span: 2
	},
	{
		label: "Planned use of funds",
		placeholder: "Expansion, fleet acquisition, working capital…",
		type: "textarea",
		span: 2
	},
	{
		label: "Desired listing timeline",
		placeholder: "Select timeline",
		type: "select",
		options: [
			"Q3 2026",
			"Q4 2026",
			"Q1 2027",
			"Flexible"
		]
	},
	{
		label: "Public float percentage",
		placeholder: "25%"
	},
	{
		label: "Dividend policy",
		placeholder: "Select policy",
		type: "select",
		options: [
			"No dividend planned",
			"Quarterly dividend",
			"Annual dividend",
			"To be determined"
		]
	}
];
var contactFields = [
	{
		label: "Contact name",
		placeholder: "Primary listing contact"
	},
	{
		label: "Discord username",
		placeholder: "username"
	},
	{
		label: "Minecraft username",
		placeholder: "In-game name"
	},
	{
		label: "Preferred contact method",
		placeholder: "Select method",
		type: "select",
		options: [
			"Discord",
			"In-game",
			"Alta Terminal message",
			"Email on file"
		]
	}
];
function ListingApplicationForm() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FormSection, {
				title: "Company Information",
				fields: companyFields
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FormSection, {
				title: "Financial Information",
				fields: financialFields
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FormSection, {
				title: "Listing Details",
				fields: listingFields
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground",
				children: "Documents"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-6 grid gap-4 md:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UploadPlaceholder, { label: "Prospectus" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UploadPlaceholder, { label: "Financial statement" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(UploadPlaceholder, { label: "Ownership statement" })
				]
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FormSection, {
				title: "Review Preferences",
				fields: contactFields
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
				className: "border-gold/30 bg-gold/5",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[13px] leading-relaxed text-muted-foreground",
					children: "Applications are reviewed manually. Submission is simulated in this preview."
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					disabled: true,
					className: "cursor-not-allowed rounded-md border border-border bg-surface-2 px-5 py-2.5 text-[13px] font-medium text-muted-foreground",
					children: "Save Draft (preview only)"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					disabled: true,
					className: "cursor-not-allowed rounded-md bg-foreground/40 px-5 py-2.5 text-[13px] font-medium text-background/70",
					children: "Submit for Review (preview only)"
				})]
			})
		]
	});
}
function ExchangeApply() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Exchange · Listing Application",
		title: "List on Alta Exchange",
		description: "Submit your company for review by Alta Exchange. Approved companies may become eligible for IPO preparation, public listing, and market access.",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExchangeSubNav, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ListingApplicationForm, {})]
	});
}
//#endregion
export { ExchangeApply as component };
