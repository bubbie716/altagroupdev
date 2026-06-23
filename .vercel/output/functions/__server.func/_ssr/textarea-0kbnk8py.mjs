import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { c as cn } from "./page-shell-B0Lrv62S.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/textarea-0kbnk8py.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function mergeRefs(...refs) {
	return (node) => {
		for (const ref of refs) if (typeof ref === "function") ref(node);
		else if (ref) ref.current = node;
	};
}
var Textarea = import_react.forwardRef(({ className, autoResize, onInput, rows, ...props }, ref) => {
	const innerRef = import_react.useRef(null);
	const resize = import_react.useCallback(() => {
		const el = innerRef.current;
		if (!el || !autoResize) return;
		el.style.height = "auto";
		el.style.height = `${el.scrollHeight}px`;
	}, [autoResize]);
	import_react.useLayoutEffect(() => {
		resize();
	}, [
		resize,
		props.value,
		props.defaultValue
	]);
	import_react.useEffect(() => {
		if (!autoResize) return;
		window.addEventListener("resize", resize);
		return () => window.removeEventListener("resize", resize);
	}, [autoResize, resize]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
		className: cn("flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm", autoResize && "resize-none overflow-hidden", className),
		ref: mergeRefs(ref, innerRef),
		rows: autoResize ? 1 : rows,
		onInput: (e) => {
			if (autoResize) resize();
			onInput?.(e);
		},
		...props
	});
});
Textarea.displayName = "Textarea";
//#endregion
export { Textarea as t };
