import { a as formatCompanyRole, i as formatAccountStatus, o as formatUserTag } from "./permissions-DFFnJwMM.mjs";
import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { a as Section, i as PageShell, r as Card, u as useRequireCurrentUser } from "./page-shell-B0Lrv62S.mjs";
import { t as StatusBadge } from "./status-badge-C0tS4ap0.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/profile-Ba8l8MBz.js
var import_jsx_runtime = require_jsx_runtime();
function ProfileRow({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-1 border-b border-border/50 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-sm",
			children: value
		})]
	});
}
function ProfilePage() {
	const user = useRequireCurrentUser();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Account",
		title: user.discordUsername,
		description: "Your Alta identity and authorized company memberships.",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-6 lg:grid-cols-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Discord Identity",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "!p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileRow, {
							label: "Discord ID",
							value: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[12px]",
								children: user.discordId
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileRow, {
							label: "Username",
							value: user.discordUsername
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileRow, {
							label: "Email",
							value: user.email ?? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-muted-foreground",
								children: "Not provided"
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileRow, {
							label: "Avatar",
							value: user.avatarUrl ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: user.avatarUrl,
								alt: "",
								className: "size-10 rounded-full border border-border"
							}) : "—"
						})
					]
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Alta Account",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "!p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileRow, {
							label: "Minecraft",
							value: user.minecraftUsername ?? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-muted-foreground",
								children: "Not linked — placeholder for future sync"
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileRow, {
							label: "Account Status",
							value: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: formatAccountStatus(user.accountStatus) })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileRow, {
							label: "Developer / API",
							value: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: formatAccountStatus(user.developerAccessStatus) })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileRow, {
							label: "Access Tags",
							value: user.tags.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-muted-foreground",
								children: "None assigned"
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "flex flex-wrap justify-end gap-1.5",
								children: user.tags.map((tag) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: formatUserTag(tag) }, tag))
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileRow, {
							label: "Member Since",
							value: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[11px]",
								children: user.createdAt.slice(0, 10)
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ProfileRow, {
							label: "Last Login",
							value: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[11px]",
								children: user.lastLoginAt.slice(0, 10)
							})
						})
					]
				})
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
			title: "Linked Companies",
			className: "mt-10",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
				className: "!p-0",
				children: user.companyMemberships.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "p-5 text-sm text-muted-foreground",
					children: "No company memberships. Authorized representatives will appear here once assigned."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-3",
								children: "Company"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-3",
								children: "Type"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-3",
								children: "Ticker"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-3",
								children: "Your Role"
							})
						]
					}) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: user.companyMemberships.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-b border-border/50 last:border-0",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-3",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: "/companies/$companyId",
									params: { companyId: m.companyId },
									className: "font-medium hover:text-gold",
									children: m.companyName
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-3 text-muted-foreground",
								children: m.companyType
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-3 font-mono text-[12px]",
								children: m.companyTicker ?? "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-3 font-mono text-[11px]",
								children: formatCompanyRole(m.role)
							})
						]
					}, m.companyId)) })]
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-3 text-[12px] text-muted-foreground",
				children: [
					"Companies do not log in directly. Memberships grant authorized representatives access to act on behalf of registered entities.",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/companies",
						className: "text-gold hover:underline",
						children: "Manage companies →"
					})
				]
			})]
		})]
	});
}
//#endregion
export { ProfilePage as component };
