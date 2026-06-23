import { a as formatCompanyRole } from "./_ssr/permissions-DFFnJwMM.mjs";
import { g as Link } from "./_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "./_libs/@radix-ui/react-arrow+[...].mjs";
import { a as Section, i as PageShell, r as Card } from "./_ssr/page-shell-B0Lrv62S.mjs";
import { t as Route } from "./_companyId-BudqImoe.mjs";
import { t as StatusBadge } from "./_ssr/status-badge-C0tS4ap0.mjs";
import { t as CompanySubNav } from "./_ssr/company-sub-nav-DAiQ8klN.mjs";
import { t as MockActionButton } from "./_ssr/mock-action-button-stf4eZhi.mjs";
import { a as formatIntendedUse } from "./_ssr/types-B_xrYiVU.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_companyId-BiopI9Ic.js
var import_jsx_runtime = require_jsx_runtime();
var modules = [
	{
		title: "Business Banking",
		description: "Treasury accounts, wires, and institutional deposit products for registered entities.",
		status: "Preview"
	},
	{
		title: "IPO / Listing",
		description: "Listing applications, regulatory review, and Alta Exchange onboarding.",
		status: "Preview"
	},
	{
		title: "Issuer Portal",
		description: "Corporate announcements, financial updates, and investor communications.",
		status: "Preview"
	},
	{
		title: "API Access",
		description: "Licensed market data and institutional integration credentials.",
		status: "Preview"
	}
];
function CompanyFutureModules() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "grid gap-4 md:grid-cols-2",
		children: modules.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
			className: "!p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "font-medium tracking-tight",
						children: m.title
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "rounded bg-surface-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground",
						children: m.status
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-[13px] leading-relaxed text-muted-foreground",
					children: m.description
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, { label: "Open module" })
				})
			]
		}, m.title))
	});
}
function ProfileRow({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-1 border-b border-border/50 py-3 last:border-0 sm:flex-row sm:items-start sm:justify-between",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-sm sm:max-w-md sm:text-right",
			children: value
		})]
	});
}
function CompanyDetailPage() {
	const company = Route.useLoaderData();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Account · Company Workspace",
		title: company.name,
		description: `${company.type} · ${company.sector ?? "Sector pending"} · Authorized representative workspace`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/companies",
				className: "mb-6 inline-block font-mono text-[11px] uppercase tracking-[0.16em] text-gold hover:underline",
				children: "← All companies"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-6 flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: company.status }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: company.verificationStatus }),
					company.ticker && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "rounded bg-surface-2 px-2 py-0.5 font-mono text-[11px]",
						children: company.ticker
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompanySubNav, { companyId: company.id }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-6 lg:grid-cols-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "Company profile",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
						className: "!p-5",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileRow, {
								label: "Type",
								value: company.type
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileRow, {
								label: "Sector",
								value: company.sector ?? "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileRow, {
								label: "Ticker",
								value: company.ticker ?? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-muted-foreground",
									children: company.desiredTicker ? `Requested: ${company.desiredTicker}` : "—"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileRow, {
								label: "Headquarters",
								value: company.headquarters ?? "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileRow, {
								label: "Primary contact",
								value: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono text-[12px]",
									children: company.primaryContactDiscordUsername ?? "—"
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileRow, {
								label: "Intended use",
								value: company.intendedUses.length === 0 ? "—" : company.intendedUses.map(formatIntendedUse).join(", ")
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileRow, {
								label: "Registered",
								value: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono text-[11px]",
									children: company.createdAt.slice(0, 10)
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileRow, {
								label: "Your role",
								value: formatCompanyRole(company.currentUserRole)
							})
						]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "Description",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
						className: "!p-5",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-[14px] leading-relaxed text-muted-foreground",
							children: company.description ?? "No description provided."
						})
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
				title: "Authorized representatives",
				className: "mt-10",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					className: "!p-0",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
						className: "w-full text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-4 py-3",
									children: "Representative"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-4 py-3",
									children: "Role"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "px-4 py-3",
									children: "Since"
								})
							]
						}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: company.members.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-border/50 last:border-0",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-3 font-mono text-[12px]",
									children: m.discordUsername
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-3",
									children: formatCompanyRole(m.role)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-3 font-mono text-[11px] text-muted-foreground",
									children: m.joinedAt.slice(0, 10)
								})
							]
						}, m.membershipId)) })]
					})
				}), company.canManageMembers && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/companies/$companyId/members",
					params: { companyId: company.id },
					className: "mt-4 inline-block font-mono text-[11px] uppercase tracking-[0.16em] text-gold hover:underline",
					children: "Manage members →"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Modules",
				className: "mt-12",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompanyFutureModules, {})
			})
		]
	});
}
//#endregion
export { CompanyDetailPage as component };
