import { o as __toESM } from "../_runtime.mjs";
import { g as Link, y as useRouter } from "../_libs/@tanstack/react-router+[...].mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { c as cn, d as useServerFn, i as PageShell, r as Card, u as useRequireCurrentUser } from "./page-shell-B0Lrv62S.mjs";
import { n as INTENDED_USE_OPTIONS, t as COMPANY_TYPE_OPTIONS } from "./types-B_xrYiVU.mjs";
import { n as createCompanyRecord } from "./company.functions-D3p9jChI.mjs";
import { t as Textarea } from "./textarea-0kbnk8py.mjs";
import { t as Input } from "./input-C9VaRSFn.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/create-AI_ZySyN.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var fieldLabel = "font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground";
function CompanyCreateForm() {
	const user = useRequireCurrentUser();
	const router = useRouter();
	const createCompany = useServerFn(createCompanyRecord);
	const [error, setError] = (0, import_react.useState)(null);
	const [submitting, setSubmitting] = (0, import_react.useState)(false);
	const [name, setName] = (0, import_react.useState)("");
	const [type, setType] = (0, import_react.useState)("private_company");
	const [sector, setSector] = (0, import_react.useState)("");
	const [desiredTicker, setDesiredTicker] = (0, import_react.useState)("");
	const [description, setDescription] = (0, import_react.useState)("");
	const [headquarters, setHeadquarters] = (0, import_react.useState)("");
	const [primaryContact, setPrimaryContact] = (0, import_react.useState)(user.discordUsername);
	const [intendedUses, setIntendedUses] = (0, import_react.useState)([]);
	function toggleUse(use) {
		setIntendedUses((prev) => prev.includes(use) ? prev.filter((u) => u !== use) : [...prev, use]);
	}
	async function handleSubmit(e) {
		e.preventDefault();
		setError(null);
		setSubmitting(true);
		try {
			const result = await createCompany({ data: {
				name,
				type,
				sector,
				desiredTicker: desiredTicker || void 0,
				description,
				headquarters: headquarters || void 0,
				primaryContactDiscordUsername: primaryContact,
				intendedUses
			} });
			await router.invalidate();
			await router.navigate({
				to: "/companies/$companyId",
				params: { companyId: result.companyId }
			});
		} catch {
			setError("Unable to register company. Check required fields and try again.");
		} finally {
			setSubmitting(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("form", {
		onSubmit: handleSubmit,
		className: "mx-auto max-w-2xl",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "space-y-6 !p-6",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[13px] leading-relaxed text-muted-foreground",
					children: "Register a company or institution on Alta. You will be assigned as the primary owner and authorized representative. Companies do not log in directly — individuals act on their behalf through membership roles."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "block",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: fieldLabel,
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
						className: fieldLabel,
						children: "Company type"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
						className: "mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm",
						value: type,
						onChange: (e) => setType(e.target.value),
						children: COMPANY_TYPE_OPTIONS.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: o.value,
							children: o.label
						}, o.value))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "block",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: fieldLabel,
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
						className: fieldLabel,
						children: "Desired ticker (optional)"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						className: "mt-2 font-mono uppercase",
						value: desiredTicker,
						onChange: (e) => setDesiredTicker(e.target.value.toUpperCase()),
						placeholder: "e.g. ACME",
						maxLength: 8
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "block",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: fieldLabel,
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
						className: fieldLabel,
						children: "Headquarters (optional)"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						className: "mt-2",
						value: headquarters,
						onChange: (e) => setHeadquarters(e.target.value),
						placeholder: "Newport, Republic of Alta"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "block",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: fieldLabel,
						children: "Primary contact Discord username"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						className: "mt-2 font-mono",
						value: primaryContact,
						onChange: (e) => setPrimaryContact(e.target.value),
						required: true
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
					className: fieldLabel,
					children: "Intended use"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-3 space-y-2",
					children: INTENDED_USE_OPTIONS.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "flex cursor-pointer items-center gap-3 text-[13px]",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: intendedUses.includes(o.value),
							onChange: () => toggleUse(o.value),
							className: "size-4 rounded border-border"
						}), o.label]
					}, o.value))
				})] }),
				error && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-[13px] text-destructive",
					children: error
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "submit",
					disabled: submitting || !name || !sector || !description,
					className: cn("w-full rounded-md bg-foreground px-5 py-3 text-[13px] font-medium tracking-wide text-background transition-opacity", submitting && "opacity-60"),
					children: submitting ? "Registering…" : "Register company"
				})
			]
		})
	});
}
function CreateCompanyPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Account · Companies",
		title: "Register a Company",
		description: "Establish a registered entity on Alta and become its primary authorized owner.",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/companies",
			className: "mb-8 inline-block font-mono text-[11px] uppercase tracking-[0.16em] text-gold hover:underline",
			children: "← Back to companies"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompanyCreateForm, {})]
	});
}
//#endregion
export { CreateCompanyPage as component };
