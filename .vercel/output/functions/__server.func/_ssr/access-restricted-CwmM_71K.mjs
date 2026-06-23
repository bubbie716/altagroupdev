import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { l as useCurrentUser, r as Card } from "./page-shell-B0Lrv62S.mjs";
import { i as LoginPortalShell } from "./auth-gate-BfU03Wla.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/access-restricted-CwmM_71K.js
var import_jsx_runtime = require_jsx_runtime();
function AccessRestrictedPage() {
	const user = useCurrentUser();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoginPortalShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "w-full max-w-md text-center",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-mono text-[11px] uppercase tracking-[0.28em] text-gold",
				children: "Alta Group"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "mt-3 text-2xl font-semibold tracking-tight sm:text-[1.75rem]",
				children: "Access Restricted"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mx-auto mt-3 max-w-sm text-[14px] leading-relaxed text-muted-foreground",
				children: "Your account does not have permission to view this area."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
				className: "mt-8 border-border/80 bg-card/95 !p-6 text-left shadow-sm backdrop-blur-sm",
				children: [user ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-sm text-muted-foreground",
					children: [
						"Signed in as ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium text-foreground",
							children: user.discordUsername
						}),
						". Contact Alta operations if you believe this is an error."
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted-foreground",
					children: "You must sign in with an authorized Alta account."
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 flex justify-center gap-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/",
						className: "text-sm text-gold hover:underline",
						children: "Return home"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/profile",
						className: "text-sm text-muted-foreground hover:text-foreground",
						children: "View profile"
					})]
				})]
			})
		]
	}) });
}
//#endregion
export { AccessRestrictedPage as component };
