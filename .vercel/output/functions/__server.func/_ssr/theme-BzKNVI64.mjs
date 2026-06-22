import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/theme-BzKNVI64.js
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
//#endregion
export { ThemeProvider as n, useTheme as r, THEME_INIT_SCRIPT as t };
