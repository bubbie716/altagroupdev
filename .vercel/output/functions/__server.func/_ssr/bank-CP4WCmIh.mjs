import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { a as Section } from "./page-shell-B0Lrv62S.mjs";
import { t as StatusBadge } from "./status-badge-C0tS4ap0.mjs";
import { t as MockActionButton } from "./mock-action-button-stf4eZhi.mjs";
import { a as getBankOpsLoanApplications, i as getBankOpsDepositWithdrawRequests, o as getBankOpsSummary, r as getBankOpsAccounts, s as getBankOpsTransfers } from "./api-CbUtwIPv.mjs";
import { t as InternalPageShell } from "./internal-page-shell-MM5TikUI.mjs";
import { t as AdminDataTable } from "./admin-data-table-ChY-n6-o.mjs";
import { t as InternalStatCard } from "./internal-stat-card-aLHMOm0x.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/bank-CP4WCmIh.js
var import_jsx_runtime = require_jsx_runtime();
function InternalBank() {
	const s = getBankOpsSummary();
	const accounts = getBankOpsAccounts();
	const loans = getBankOpsLoanApplications();
	const transfers = getBankOpsTransfers();
	const depositWithdraw = getBankOpsDepositWithdrawRequests();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(InternalPageShell, {
		title: "Bank Operations",
		description: "Accounts, lending queue, interbank transfers, and deposit/withdrawal requests.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalStatCard, {
						label: "Accounts",
						value: s.totalAccounts.toLocaleString()
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalStatCard, {
						label: "Loan Applications",
						value: String(s.lendingQueue),
						alert: true
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalStatCard, {
						label: "Transfers In Review",
						value: String(s.transfersInReview),
						alert: true
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalStatCard, {
						label: "Deposits Pending",
						value: String(s.pendingDeposits)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalStatCard, {
						label: "Withdrawals Pending",
						value: String(s.pendingWithdrawals),
						alert: true
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalStatCard, {
						label: "Private Invites",
						value: String(s.privateInvitesPending)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InternalStatCard, {
						label: "Frozen Accounts",
						value: String(s.frozenAccounts),
						alert: true
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Accounts",
				className: "mt-10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminDataTable, {
					columns: [
						{
							key: "id",
							header: "Account",
							cell: (a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[12px]",
								children: a.id
							})
						},
						{
							key: "holder",
							header: "Holder",
							cell: (a) => a.holder
						},
						{
							key: "product",
							header: "Product",
							cell: (a) => a.product
						},
						{
							key: "balance",
							header: "Balance",
							cell: (a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "tabular font-mono",
								children: a.balance
							})
						},
						{
							key: "status",
							header: "Status",
							cell: (a) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: a.status })
						},
						{
							key: "actions",
							header: "Actions",
							cell: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap gap-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, {
									label: "Freeze account",
									variant: "danger"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, {
									label: "Invite private",
									variant: "primary"
								})]
							})
						}
					],
					rows: accounts,
					rowKey: (a) => a.id
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Loan Applications",
				className: "mt-10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminDataTable, {
					columns: [
						{
							key: "id",
							header: "Ref",
							cell: (l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[11px]",
								children: l.id
							})
						},
						{
							key: "applicant",
							header: "Applicant",
							cell: (l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[11px]",
								children: l.applicant
							})
						},
						{
							key: "company",
							header: "Company",
							cell: (l) => l.company ?? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-muted-foreground",
								children: "—"
							})
						},
						{
							key: "product",
							header: "Product",
							cell: (l) => l.product
						},
						{
							key: "amount",
							header: "Amount",
							cell: (l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "tabular font-mono",
								children: l.amount
							})
						},
						{
							key: "purpose",
							header: "Purpose",
							cell: (l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[12px]",
								children: l.purpose
							})
						},
						{
							key: "status",
							header: "Status",
							cell: (l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: l.status })
						},
						{
							key: "submitted",
							header: "Submitted",
							cell: (l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[11px] text-muted-foreground",
								children: l.submitted
							})
						},
						{
							key: "actions",
							header: "Actions",
							cell: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap gap-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, { label: "Review" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, {
										label: "Approve",
										variant: "primary"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, {
										label: "Deny",
										variant: "danger"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, { label: "Request info" })
								]
							})
						}
					],
					rows: loans,
					rowKey: (l) => l.id
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Interbank Transfers & Wires",
				className: "mt-10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminDataTable, {
					columns: [
						{
							key: "id",
							header: "Ref",
							cell: (t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[11px]",
								children: t.id
							})
						},
						{
							key: "type",
							header: "Type",
							cell: (t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[11px]",
								children: t.type
							})
						},
						{
							key: "from",
							header: "From",
							cell: (t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[11px]",
								children: t.from
							})
						},
						{
							key: "to",
							header: "To",
							cell: (t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[11px]",
								children: t.to
							})
						},
						{
							key: "amount",
							header: "Amount",
							cell: (t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "tabular font-mono",
								children: t.amount
							})
						},
						{
							key: "settlement",
							header: "Settlement",
							cell: (t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[11px]",
								children: t.settlement
							})
						},
						{
							key: "status",
							header: "Status",
							cell: (t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: t.status })
						},
						{
							key: "submitted",
							header: "Submitted",
							cell: (t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[11px] text-muted-foreground",
								children: t.submitted
							})
						},
						{
							key: "actions",
							header: "Actions",
							cell: () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap gap-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, { label: "Review" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, {
										label: "Release",
										variant: "primary"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, { label: "Hold" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, {
										label: "Reject",
										variant: "danger"
									})
								]
							})
						}
					],
					rows: transfers,
					rowKey: (t) => t.id
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Deposit & Withdrawal Requests",
				className: "mt-10",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AdminDataTable, {
					columns: [
						{
							key: "id",
							header: "Ref",
							cell: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[11px]",
								children: r.id
							})
						},
						{
							key: "type",
							header: "Type",
							cell: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: r.type })
						},
						{
							key: "account",
							header: "Account",
							cell: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[11px]",
								children: r.account
							})
						},
						{
							key: "holder",
							header: "Holder",
							cell: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[11px]",
								children: r.holder
							})
						},
						{
							key: "amount",
							header: "Amount",
							cell: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "tabular font-mono",
								children: r.amount
							})
						},
						{
							key: "method",
							header: "Method",
							cell: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[12px]",
								children: r.method
							})
						},
						{
							key: "status",
							header: "Status",
							cell: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: r.status })
						},
						{
							key: "submitted",
							header: "Submitted",
							cell: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-mono text-[11px] text-muted-foreground",
								children: r.submitted
							})
						},
						{
							key: "actions",
							header: "Actions",
							cell: (r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap gap-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, { label: "Review" }),
									r.type === "Deposit" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, {
										label: "Post deposit",
										variant: "primary"
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, {
										label: "Release funds",
										variant: "primary"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MockActionButton, {
										label: "Reject",
										variant: "danger"
									})
								]
							})
						}
					],
					rows: depositWithdraw,
					rowKey: (r) => r.id
				})
			})
		]
	});
}
//#endregion
export { InternalBank as component };
