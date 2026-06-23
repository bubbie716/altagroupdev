import { o as __toESM } from "../_runtime.mjs";
import { a as formatCompanyRole } from "./permissions-DFFnJwMM.mjs";
import { g as Link, y as useRouter } from "../_libs/@tanstack/react-router+[...].mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { d as useServerFn, i as PageShell, r as Card } from "./page-shell-B0Lrv62S.mjs";
import { t as StatusBadge } from "./status-badge-C0tS4ap0.mjs";
import { t as CompanySubNav } from "./company-sub-nav-DAiQ8klN.mjs";
import { i as OWNER_ROLE_OPTION, r as MEMBER_ROLE_OPTIONS } from "./types-B_xrYiVU.mjs";
import { c as updateCompanyMemberRole, s as removeCompanyMember, t as addCompanyMemberByDiscord } from "./company.functions-D3p9jChI.mjs";
import { a as SelectValue, i as SelectTrigger, n as SelectContent, r as SelectItem, t as Select } from "./select-BdS1UEsc.mjs";
import { t as Input } from "./input-C9VaRSFn.mjs";
import { t as Route } from "./route-DVYT9897.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/members-DNngndL6.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function CompanyMembersPanel({ company }) {
	const router = useRouter();
	const updateRole = useServerFn(updateCompanyMemberRole);
	const removeMember = useServerFn(removeCompanyMember);
	const addMember = useServerFn(addCompanyMemberByDiscord);
	const [inviteIdentifier, setInviteIdentifier] = (0, import_react.useState)("");
	const [inviteRole, setInviteRole] = (0, import_react.useState)("viewer");
	const [inviteNotice, setInviteNotice] = (0, import_react.useState)(null);
	const [inviteSimulated, setInviteSimulated] = (0, import_react.useState)(false);
	const [actionError, setActionError] = (0, import_react.useState)(null);
	const [busyId, setBusyId] = (0, import_react.useState)(null);
	const roleOptions = company.currentUserRole === "owner" ? [OWNER_ROLE_OPTION, ...MEMBER_ROLE_OPTIONS] : MEMBER_ROLE_OPTIONS;
	async function refresh() {
		await router.invalidate();
	}
	async function handleRoleChange(membershipId, role) {
		setActionError(null);
		setBusyId(membershipId);
		try {
			await updateRole({ data: {
				companyId: company.id,
				membershipId,
				role
			} });
			await refresh();
		} catch {
			setActionError("Unable to update role. Executives cannot modify owners.");
		} finally {
			setBusyId(null);
		}
	}
	async function handleRemove(membershipId) {
		setActionError(null);
		setBusyId(membershipId);
		try {
			await removeMember({ data: {
				companyId: company.id,
				membershipId
			} });
			await refresh();
		} catch {
			setActionError("Unable to remove member. At least one owner must remain.");
		} finally {
			setBusyId(null);
		}
	}
	async function handleAddExisting() {
		setActionError(null);
		setInviteNotice(null);
		setInviteSimulated(false);
		if (!inviteIdentifier.trim()) return;
		try {
			setInviteNotice(`Added ${(await addMember({ data: {
				companyId: company.id,
				discordIdentifier: inviteIdentifier.trim(),
				role: inviteRole
			} })).username} as ${formatCompanyRole(inviteRole)}.`);
			setInviteIdentifier("");
			await refresh();
		} catch {
			setInviteSimulated(true);
			setInviteNotice("No Alta account found for that Discord user. Invitation queued for preview — Discord invitation delivery is planned for the future bot integration.");
		}
	}
	function handleSendInvitation() {
		setInviteSimulated(true);
		setInviteNotice("Invitation prepared (preview). Discord invitation delivery is planned for the future bot integration — DMs, admin channel logs, acceptance links, and role confirmation will be handled by the Alta bot.");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-8",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
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
								children: "Minecraft"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-3",
								children: "Role"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-3",
								children: "Joined"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-3",
								children: "Status"
							}),
							company.canManageMembers && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "px-4 py-3",
								children: "Actions"
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
								className: "px-4 py-3 font-mono text-[11px] text-muted-foreground",
								children: m.minecraftUsername ?? "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-3",
								children: company.canManageMembers ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
									value: m.role,
									disabled: busyId === m.membershipId,
									onValueChange: (value) => handleRoleChange(m.membershipId, value),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
										className: "h-8 w-[180px] text-[12px]",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {})
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: roleOptions.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
										value: o.value,
										children: o.label
									}, o.value)) })]
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-mono text-[11px]",
									children: formatCompanyRole(m.role)
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-3 font-mono text-[11px] text-muted-foreground",
								children: m.joinedAt.slice(0, 10)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-3",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "Authorized" })
							}),
							company.canManageMembers && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "px-4 py-3",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									disabled: busyId === m.membershipId,
									onClick: () => handleRemove(m.membershipId),
									className: "font-mono text-[10px] uppercase tracking-[0.14em] text-destructive hover:underline disabled:opacity-50",
									children: "Remove"
								})
							})
						]
					}, m.membershipId)) })]
				})
			}),
			actionError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[13px] text-destructive",
				children: actionError
			}),
			company.canManageMembers && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "space-y-5 !p-6",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "font-medium tracking-tight",
						children: "Invite authorized representative"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-[13px] leading-relaxed text-muted-foreground",
						children: "Add an existing Alta user by Discord username or ID. Users without an Alta account receive a preview invitation state until the Discord bot integration ships."
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid gap-4 md:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "block",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground",
								children: "Discord username or ID"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								className: "mt-2 font-mono",
								value: inviteIdentifier,
								onChange: (e) => setInviteIdentifier(e.target.value),
								placeholder: "username or 18-digit ID"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "block",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground",
								children: "Role"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Select, {
								value: inviteRole,
								onValueChange: (v) => setInviteRole(v),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectTrigger, {
									className: "mt-2",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectValue, {})
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectContent, { children: MEMBER_ROLE_OPTIONS.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SelectItem, {
									value: o.value,
									children: o.label
								}, o.value)) })]
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: handleAddExisting,
							className: "rounded-md bg-foreground px-4 py-2 text-[13px] font-medium text-background",
							children: "Add existing user"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: handleSendInvitation,
							className: "rounded-md border border-border px-4 py-2 text-[13px] font-medium",
							children: "Send invitation"
						})]
					}),
					inviteNotice && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Card, {
						className: inviteSimulated ? "border-gold/30 bg-gold/5 !p-4 text-[13px] leading-relaxed text-muted-foreground" : "!p-4 text-[13px] text-foreground",
						children: inviteNotice
					})
				]
			})
		]
	});
}
function CompanyMembersPage() {
	const company = Route.useLoaderData();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Account · Company Workspace",
		title: `${company.name} — Members`,
		description: "Authorized representatives and membership roles for this registered entity.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/companies/$companyId",
				params: { companyId: company.id },
				className: "mb-6 inline-block font-mono text-[11px] uppercase tracking-[0.16em] text-gold hover:underline",
				children: "← Company overview"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompanySubNav, { companyId: company.id }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompanyMembersPanel, { company })
		]
	});
}
//#endregion
export { CompanyMembersPage as component };
