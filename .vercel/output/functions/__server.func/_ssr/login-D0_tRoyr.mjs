import { g as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { l as useCurrentUser, r as Card } from "./page-shell-B0Lrv62S.mjs";
import { i as LoginPortalShell, r as LoginPortalFooter, t as AuthGate } from "./auth-gate-BfU03Wla.mjs";
import { t as Route } from "./login-rc708a2U.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/login-D0_tRoyr.js
var import_jsx_runtime = require_jsx_runtime();
var ERROR_MESSAGES = {
	oauth_denied: "Discord authorization was cancelled.",
	invalid_state: "Login session expired. Please try again.",
	token_exchange_failed: "Could not complete Discord sign-in.",
	profile_fetch_failed: "Could not load your Discord profile.",
	oauth_not_configured: "Discord OAuth is not configured on this environment.",
	database_not_configured: "Database is not configured (DATABASE_URL).",
	session_not_configured: "Session signing is not configured (SESSION_SECRET).",
	session_failed: "Could not create a login session."
};
function LoginPage() {
	const { redirect, error } = Route.useSearch();
	const user = useCurrentUser();
	if (user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoginPortalShell, {
		footer: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoginPortalFooter, {}),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-md text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-mono text-[11px] uppercase tracking-[0.28em] text-gold",
					children: "Alta Group"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "mt-3 text-2xl font-semibold tracking-tight",
					children: "Already signed in"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "mt-8 border-border/80 bg-card/95 !p-6 text-left shadow-sm backdrop-blur-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "text-sm text-muted-foreground",
						children: [
							"Signed in as ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "font-medium text-foreground",
								children: user.discordUsername
							}),
							"."
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: redirect ?? "/profile",
						className: "mt-4 inline-block text-sm text-gold underline-offset-2 hover:underline",
						children: "Continue to platform →"
					})]
				})
			]
		})
	});
	const redirectTo = redirect ?? "/profile";
	const errorMessage = error ? ERROR_MESSAGES[error] : void 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoginPortalShell, {
		footer: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoginPortalFooter, {}),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthGate, {
			redirectTo,
			errorMessage
		})
	});
}
//#endregion
export { LoginPage as component };
