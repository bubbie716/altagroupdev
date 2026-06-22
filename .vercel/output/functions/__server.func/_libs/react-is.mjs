import { t as __commonJSMin } from "../_runtime.mjs";
//#region node_modules/react-is/cjs/react-is.production.js
/**
* @license React
* react-is.production.js
*
* Copyright (c) Meta Platforms, Inc. and affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_react_is_production = /* @__PURE__ */ __commonJSMin(((exports) => {
	var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_VIEW_TRANSITION_TYPE = Symbol.for("react.view_transition");
	function typeOf(object) {
		if ("object" === typeof object && null !== object) {
			var $$typeof = object.$$typeof;
			switch ($$typeof) {
				case REACT_ELEMENT_TYPE: switch (object = object.type, object) {
					case REACT_FRAGMENT_TYPE:
					case REACT_PROFILER_TYPE:
					case REACT_STRICT_MODE_TYPE:
					case REACT_SUSPENSE_TYPE:
					case REACT_SUSPENSE_LIST_TYPE:
					case REACT_VIEW_TRANSITION_TYPE: return object;
					default: switch (object = object && object.$$typeof, object) {
						case REACT_CONTEXT_TYPE:
						case REACT_FORWARD_REF_TYPE:
						case REACT_LAZY_TYPE:
						case REACT_MEMO_TYPE: return object;
						case REACT_CONSUMER_TYPE: return object;
						default: return $$typeof;
					}
				}
				case REACT_PORTAL_TYPE: return $$typeof;
			}
		}
	}
	exports.isFragment = function(object) {
		return typeOf(object) === REACT_FRAGMENT_TYPE;
	};
}));
//#endregion
//#region node_modules/react-is/index.js
var require_react_is = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_react_is_production();
}));
//#endregion
export { require_react_is as t };
