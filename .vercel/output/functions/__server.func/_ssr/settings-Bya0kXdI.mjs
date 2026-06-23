import { o as __toESM } from "../_runtime.mjs";
import { g as Link, y as useRouter } from "../_libs/@tanstack/react-router+[...].mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { d as useServerFn, i as PageShell, r as Card } from "./page-shell-B0Lrv62S.mjs";
import { t as CompanySubNav } from "./company-sub-nav-DAiQ8klN.mjs";
import { t as MockActionButton } from "./mock-action-button-stf4eZhi.mjs";
import { l as updateCompanySettingsRecord } from "./company.functions-D3p9jChI.mjs";
import { t as Textarea } from "./textarea-0kbnk8py.mjs";
import { t as Input } from "./input-C9VaRSFn.mjs";
import { t as Route } from "./route-DVYT9897.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings-Bya0kXdI.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function CompanySettingsForm({ company }) {
	const router = useRouter();
	const updateSettings = useServerFn(updateCompanySettingsRecord);
	const [name, setName] = (0, import_react.useState)(company.name);
	const [sector, setSector] = (0, import_react.useState)(company.sector ?? "");
	const [description, setDescription] = (0, import_react.useState)(company.description ?? "");
	const [headquarters, setHeadquarters] = (0, import_react.useState)(company.headquarters ?? "");
	const [desiredTicker, setDesiredTicker] = (0, import_react.useState)(company.desiredTicker ?? "");
	const [saving, setSaving] = (0, import_react.useState)(false);
	const [message, setMessage] = (0, import_react.useState)(null);
	const [error, setError] = (0, import_react.useState)(null);
	const tickerLocked = company.ticker !== null;
	async function handleSubmit(e) {
		e.preventDefault();
		setSaving(true);
		setError(null);
		setMessage(null);
		try {
			await updateSettings({ data: {
				companyId: company.id,
				name,
				sector,
				description,
				headquarters: headquarters || void 0,
				desiredTicker: tickerLocked ? void 0 : desiredTicker || void 0
			} });
			setMessage("Company profile updated.");
			await router.invalidate();
		} catch {
			setError("Unable to save settings. Only owners may edit company profile.");
		} finally {
			setSaving(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mx-auto max-w-2xl space-y-8",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("form", {
			onSubmit: handleSubmit,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-5 !p-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "font-medium tracking-tight",
						children: "Company profile"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground",
							children: "Company name"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							className: "mt-2",
							value: name,
							onChange: (e) => setName(e.target.value),
							required: true
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground",
							children: "Sector"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							className: "mt-2",
							value: sector,
							onChange: (e) => setSector(e.target.value),
							required: true
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground",
							children: "Description"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							className: "mt-2 min-h-[120px]",
							value: description,
							onChange: (e) => setDescription(e.target.value),
							required: true
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground",
							children: "Headquarters"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							className: "mt-2",
							value: headquarters,
							onChange: (e) => setHeadquarters(e.target.value)
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "block",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground",
								children: "Desired ticker"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								className: "mt-2 font-mono uppercase",
								value: desiredTicker,
								onChange: (e) => setDesiredTicker(e.target.value.toUpperCase()),
								disabled: tickerLocked,
								maxLength: 8
							}),
							tickerLocked && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-2 text-[12px] text-muted-foreground",
								children: [
									"Official ticker ",
									company.ticker,
									" is assigned — desired ticker cannot be changed."
								]
							})
						]
					}),
					message && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[13px] text-foreground",
						children: message
					}),
					error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-[13px] text-destructive",
						children: error
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "submit",
						disabled: saving,
						className: "rounded-md bg-foreground px-5 py-2.5 text-[13px] font-medium text-background disabled:opacity-60",
						children: saving ? "Saving…" : "Save changes"
					})
				]
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "space-y-4 border-destructive/30 !p-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "font-medium tracking-tight text-destructive",
					children: "Danger zone"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[13px] leading-relaxed text-muted-foreground",
					children: "Ownership transfer, archival, and verification requests require Alta operations review. These actions are simulated in this release."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, {
							label: "Transfer ownership",
							variant: "danger"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, {
							label: "Archive company",
							variant: "danger"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, {
							label: "Request verification",
							variant: "primary"
						})
					]
				})
			]
		})]
	});
}
function CompanySettingsPage() {
	const company = Route.useLoaderData();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Account · Company Workspace",
		title: `${company.name} — Settings`,
		description: "Company profile settings. Verification status and listing state are managed by Alta operations.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/companies/$companyId",
				params: { companyId: company.id },
				className: "mb-6 inline-block font-mono text-[11px] uppercase tracking-[0.16em] text-gold hover:underline",
				children: "← Company overview"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompanySubNav, { companyId: company.id }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompanySettingsForm, { company })
		]
	});
}
//#endregion
export { CompanySettingsPage as component };
