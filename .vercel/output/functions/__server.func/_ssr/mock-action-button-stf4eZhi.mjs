import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { c as cn } from "./page-shell-B0Lrv62S.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/mock-action-button-stf4eZhi.js
var import_jsx_runtime = require_jsx_runtime();
function MockActionButton({ label, variant = "default" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		disabled: true,
		className: cn("cursor-not-allowed rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.1em] opacity-60", variant === "danger" && "border-[var(--destructive)]/40 text-[var(--destructive)]", variant === "primary" && "border-gold/40 text-gold", variant === "default" && "border-border text-muted-foreground"),
		children: label
	});
}
//#endregion
export { MockActionButton as t };
