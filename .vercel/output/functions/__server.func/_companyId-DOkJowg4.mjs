import { g as Link } from "./_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "./_libs/@radix-ui/react-arrow+[...].mjs";
import { a as Section, r as Card } from "./_ssr/page-shell-B0Lrv62S.mjs";
import { t as StatusBadge } from "./_ssr/status-badge-C0tS4ap0.mjs";
import { t as MockActionButton } from "./_ssr/mock-action-button-stf4eZhi.mjs";
import { t as Route } from "./_companyId-ChpqZn4h.mjs";
import { t as InternalPageShell } from "./_ssr/internal-page-shell-MM5TikUI.mjs";
import { t as formatCompanyRole } from "./_ssr/format-CN_yXT9F.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/_companyId-DOkJowg4.js
var import_jsx_runtime = require_jsx_runtime();
function InternalCompanyDetail() {
	const data = Route.useLoaderData();
	if (!data) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalPageShell, {
		title: "Company Not Found",
		description: "No registered entity matches this ID.",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/internal/companies",
			className: "font-mono text-[12px] text-gold hover:underline",
			children: "← Back to companies"
		})
	});
	if (data.source === "db") {
		const company = data.company;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(InternalPageShell, {
			title: company.name,
			description: `${company.type} · ${company.sector ?? "—"} · ${company.id}`,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/internal/companies",
					className: "mb-6 inline-block font-mono text-[12px] text-gold hover:underline",
					children: "← Back to companies"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-8 flex flex-wrap gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: company.status }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: company.verificationStatus }),
						company.ticker && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "rounded bg-surface-2 px-2 py-0.5 font-mono text-[11px]",
							children: company.ticker
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
					title: "Authorized Representatives",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
						className: "!p-0",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
							className: "w-full text-sm",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
								className: "border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
										className: "px-4 py-3",
										children: "User"
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
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-8 flex flex-wrap gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, {
							label: "Verify",
							variant: "primary"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, {
							label: "Suspend",
							variant: "danger"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, { label: "Add representative" })
					]
				})
			]
		});
	}
	const company = data.company;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(InternalPageShell, {
		title: company.name,
		description: `${company.type} · ${company.sector} · ${company.id}`,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/internal/companies",
				className: "mb-6 inline-block font-mono text-[12px] text-gold hover:underline",
				children: "← Back to companies"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-8 flex flex-wrap gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: company.status }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: company.verificationStatus }),
					company.ticker && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "rounded bg-surface-2 px-2 py-0.5 font-mono text-[11px]",
						children: company.ticker
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Authorized Representatives (mock data)",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
					className: "!p-0",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("table", {
						className: "w-full text-sm",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: company.representatives.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-border/50 last:border-0",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-3 font-mono",
									children: r.username
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-3",
									children: formatCompanyRole(r.role)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "px-4 py-3",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: r.status })
								})
							]
						}, r.userId)) })
					})
				})
			})
		]
	});
}
//#endregion
export { InternalCompanyDetail as component };
