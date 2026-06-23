import { o as __toESM } from "../_runtime.mjs";
import { t as getServerFnById } from "../__23tanstack-start-server-fn-resolver-DGLiANyM.mjs";
import { i as TSS_SERVER_FUNCTION, l as createServerFn } from "./esm-Dova13aH.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/auth.functions-AvLZQ5C2.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var ThemeCtx = (0, import_react.createContext)({
	theme: "dark",
	toggle: () => {},
	set: () => {}
});
var THEME_INIT_SCRIPT = `
(function(){try{
  var s=localStorage.getItem('alta-theme');
  var m=window.matchMedia('(prefers-color-scheme: dark)').matches;
  var t=s||(m?'dark':'light');
  var c=document.documentElement.classList;
  if(t==='dark')c.add('dark');else c.remove('dark');
}catch(e){document.documentElement.classList.add('dark');}})();
`;
function ThemeProvider({ children }) {
	const [theme, setTheme] = (0, import_react.useState)("dark");
	(0, import_react.useEffect)(() => {
		setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
	}, []);
	const set = (t) => {
		setTheme(t);
		const c = document.documentElement.classList;
		if (t === "dark") c.add("dark");
		else c.remove("dark");
		try {
			localStorage.setItem("alta-theme", t);
		} catch {}
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThemeCtx.Provider, {
		value: {
			theme,
			toggle: () => set(theme === "dark" ? "light" : "dark"),
			set
		},
		children
	});
}
var useTheme = () => (0, import_react.useContext)(ThemeCtx);
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
/** Load authenticated user from persisted session (RPC-safe). */
var fetchCurrentUser = createServerFn({ method: "GET" }).handler(createSsrRpc("07ab98c7d9d0767d03d4a311be606fd22b3e15207d2e410fa5628e752e63548e"));
/** True when the session user has internal access (admin or operator tag). */
var verifyInternalAccess = createServerFn({ method: "GET" }).handler(createSsrRpc("a0ab5e30f64119bee4f78e74fdf5da4ee035e14916671c29321c5572f20aa97c"));
/** True when the session user has the private_client tag. */
var verifyPrivateClientAccess = createServerFn({ method: "GET" }).handler(createSsrRpc("e3a1afeeb5f28724385453bb7804867542865c37b25db4bd251663f6d4b76053"));
/** True when the session user has developer access (tag or approved workflow). */
var verifyDeveloperAccess = createServerFn({ method: "GET" }).handler(createSsrRpc("f4d0bd53681593619da24fb073b3d7cdfc7d282fb71f629d8516af0b22f589e7"));
/** True when the session user may access the issuer portal for the given ticker. */
var verifyIssuerPortalAccess = createServerFn({ method: "GET" }).validator((input) => input).handler(createSsrRpc("7050472322b6db171cd736fd8c1ccb908164f69c2d9e97455d469ee77e9a3a23"));
/** Destroy persisted session and clear cookie. */
var logoutUser = createServerFn({ method: "POST" }).handler(createSsrRpc("6e36ea5d2ba8019d6aaff2e4ad493c00a5a5b8ae3fbe14a1ac92a355257ab3c3"));
//#endregion
export { logoutUser as a, verifyInternalAccess as c, fetchCurrentUser as i, verifyIssuerPortalAccess as l, ThemeProvider as n, useTheme as o, createSsrRpc as r, verifyDeveloperAccess as s, THEME_INIT_SCRIPT as t, verifyPrivateClientAccess as u };
