import { o as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { s as require_jsx_runtime } from "../_libs/@radix-ui/react-arrow+[...].mjs";
import { t as extendTailwindMerge } from "../_libs/tailwind-merge.mjs";
import { a as Section, i as PageShell, r as Card } from "./page-shell-B0Lrv62S.mjs";
import { l as getPrivateBanking, u as getPrivateMetrics } from "./api-BMHYd9JH.mjs";
import { t as BankSubNav } from "./bank-sub-nav-4JcDc0gI.mjs";
import { t as BankStatCard } from "./bank-stat-card-7UCf14uE.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/private-CmAQx6Ty.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function PrivateTierCard({ label, value, detail }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground",
			children: label
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-3 text-lg font-semibold tracking-tight",
			children: value
		}),
		detail && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 text-[13px] leading-relaxed text-muted-foreground",
			children: detail
		})
	] });
}
/**
* This function is a wrapper around the twMerge function.
* It is used to merge the classes inside style objects.
*/
var cx = extendTailwindMerge({ extend: { theme: { text: [
	"display-xs",
	"display-sm",
	"display-md",
	"display-lg",
	"display-xl",
	"display-2xl"
] } } });
/**
* This function does nothing besides helping us to be able to
* sort the classes inside style objects which is not supported
* by the Tailwind IntelliSense by default.
*/
function sortCx(classes) {
	return classes;
}
var PaypassIcon = (props) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "20",
		height: "24",
		viewBox: "0 0 20 24",
		fill: "none",
		...props,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("g", {
			clipPath: "url(#clip0_1307_7682)",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M15.1429 1.28571C17.0236 4.54326 18.0138 8.23849 18.0138 12C18.0138 15.7615 17.0236 19.4567 15.1429 22.7143M10.4286 3.64285C11.8956 6.18374 12.6679 9.06602 12.6679 12C12.6679 14.934 11.8956 17.8162 10.4286 20.3571M5.92859 5.80713C6.98933 7.66394 7.54777 9.77022 7.54777 11.9143C7.54777 14.0583 6.98933 16.1646 5.92859 18.0214M1.42859 8.14285C2.19306 9.29983 2.59834 10.6362 2.59834 12C2.59834 13.3638 2.19306 14.7002 1.42859 15.8571",
				stroke: "currentColor",
				strokeWidth: "2.57143",
				strokeLinecap: "round"
			})
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("defs", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("clipPath", {
			id: "clip0_1307_7682",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
				width: "20",
				height: "24",
				fill: "white"
			})
		}) })]
	});
};
var MastercardIconWhite = (props) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "30",
		height: "19",
		viewBox: "0 0 30 19",
		fill: "none",
		...props,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				opacity: "0.5",
				fillRule: "evenodd",
				clipRule: "evenodd",
				d: "M14.9053 16.4392C13.3266 17.7699 11.2787 18.5733 9.04092 18.5733C4.04776 18.5733 0 14.5737 0 9.63994C0 4.70619 4.04776 0.706604 9.04092 0.706604C11.2787 0.706604 13.3266 1.50993 14.9053 2.84066C16.484 1.50993 18.5319 0.706604 20.7697 0.706604C25.7629 0.706604 29.8106 4.70619 29.8106 9.63994C29.8106 14.5737 25.7629 18.5733 20.7697 18.5733C18.5319 18.5733 16.484 17.7699 14.9053 16.4392Z",
				fill: "white"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				opacity: "0.5",
				fillRule: "evenodd",
				clipRule: "evenodd",
				d: "M14.9053 16.4392C16.8492 14.8007 18.0818 12.3625 18.0818 9.63994C18.0818 6.91733 16.8492 4.47919 14.9053 2.84066C16.484 1.50993 18.5319 0.706604 20.7697 0.706604C25.7628 0.706604 29.8106 4.70619 29.8106 9.63994C29.8106 14.5737 25.7628 18.5733 20.7697 18.5733C18.5319 18.5733 16.484 17.7699 14.9053 16.4392Z",
				fill: "white"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				fillRule: "evenodd",
				clipRule: "evenodd",
				d: "M14.9053 16.4392C16.8492 14.8007 18.0818 12.3625 18.0818 9.63995C18.0818 6.91736 16.8492 4.47924 14.9053 2.8407C12.9614 4.47924 11.7288 6.91736 11.7288 9.63995C11.7288 12.3625 12.9614 14.8007 14.9053 16.4392Z",
				fill: "white"
			})
		]
	});
};
var MastercardIcon = (props) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		width: "30",
		height: "19",
		viewBox: "0 0 30 19",
		fill: "none",
		...props,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				fillRule: "evenodd",
				clipRule: "evenodd",
				d: "M14.9053 16.4393C13.3266 17.77 11.2787 18.5733 9.04092 18.5733C4.04776 18.5733 0 14.5737 0 9.64C0 4.70625 4.04776 0.706665 9.04092 0.706665C11.2787 0.706665 13.3266 1.51 14.9053 2.84072C16.484 1.51 18.5319 0.706665 20.7697 0.706665C25.7629 0.706665 29.8106 4.70625 29.8106 9.64C29.8106 14.5737 25.7629 18.5733 20.7697 18.5733C18.5319 18.5733 16.484 17.77 14.9053 16.4393Z",
				fill: "#ED0006"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				fillRule: "evenodd",
				clipRule: "evenodd",
				d: "M14.9053 16.4393C16.8492 14.8007 18.0818 12.3626 18.0818 9.64C18.0818 6.91739 16.8492 4.47925 14.9053 2.84072C16.484 1.50999 18.5319 0.706665 20.7697 0.706665C25.7628 0.706665 29.8106 4.70625 29.8106 9.64C29.8106 14.5737 25.7628 18.5733 20.7697 18.5733C18.5319 18.5733 16.484 17.77 14.9053 16.4393Z",
				fill: "#F9A000"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				fillRule: "evenodd",
				clipRule: "evenodd",
				d: "M14.9053 16.4393C16.8492 14.8008 18.0818 12.3627 18.0818 9.64007C18.0818 6.91748 16.8492 4.47936 14.9053 2.84082C12.9614 4.47936 11.7288 6.91748 11.7288 9.64007C11.7288 12.3627 12.9614 14.8008 14.9053 16.4393Z",
				fill: "#FF5E00"
			})
		]
	});
};
var styles = sortCx({
	transparent: {
		root: "bg-black/10 bg-linear-to-br from-white/30 to-transparent backdrop-blur-[6px] before:pointer-events-none before:absolute before:inset-0 before:z-1 before:rounded-[inherit] before:mask-linear-135 before:mask-linear-to-white/20 before:ring-1 before:ring-white/30 before:ring-inset",
		company: "text-white",
		footerText: "text-white",
		paypassIcon: "text-white",
		cardTypeRoot: "bg-white/10"
	},
	"transparent-gradient": {
		root: "bg-black/10 bg-linear-to-br from-white/30 to-transparent backdrop-blur-[6px] before:pointer-events-none before:absolute before:inset-0 before:z-1 before:rounded-[inherit] before:mask-linear-135 before:mask-linear-to-white/20 before:ring-1 before:ring-white/30 before:ring-inset",
		company: "text-white",
		footerText: "text-white",
		paypassIcon: "text-white",
		cardTypeRoot: "bg-white/10"
	},
	"brand-dark": {
		root: "bg-linear-to-tr from-brand-900 to-brand-700 before:pointer-events-none before:absolute before:inset-0 before:z-1 before:rounded-[inherit] before:mask-linear-135 before:mask-linear-to-white/20 before:ring-1 before:ring-white/30 before:ring-inset",
		company: "text-white",
		footerText: "text-white",
		paypassIcon: "text-white",
		cardTypeRoot: "bg-white/10"
	},
	"brand-light": {
		root: "bg-brand-100 before:pointer-events-none before:absolute before:inset-0 before:z-1 before:rounded-[inherit] before:mask-linear-135 before:mask-linear-to-white/20 before:ring-1 before:ring-black/10 before:ring-inset",
		company: "text-neutral-700",
		footerText: "text-neutral-700",
		paypassIcon: "text-white",
		cardTypeRoot: "bg-white"
	},
	"gray-dark": {
		root: "bg-linear-to-tr from-neutral-900 to-neutral-700 before:pointer-events-none before:absolute before:inset-0 before:z-1 before:rounded-[inherit] before:mask-linear-135 before:mask-linear-to-white/20 before:ring-1 before:ring-white/30 before:ring-inset",
		company: "text-white",
		footerText: "text-white",
		paypassIcon: "text-white",
		cardTypeRoot: "bg-white/10"
	},
	"gray-light": {
		root: "bg-neutral-100 before:pointer-events-none before:absolute before:inset-0 before:z-1 before:rounded-[inherit] before:mask-linear-135 before:mask-linear-to-white/20 before:ring-1 before:ring-black/10 before:ring-inset",
		company: "text-neutral-700",
		footerText: "text-neutral-700",
		paypassIcon: "text-neutral-400",
		cardTypeRoot: "bg-white"
	},
	"transparent-strip": {
		root: "bg-linear-to-br from-white/30 to-transparent backdrop-blur-[6px] before:pointer-events-none before:absolute before:inset-0 before:z-1 before:rounded-[inherit] before:mask-linear-135 before:mask-linear-to-white/20 before:ring-1 before:ring-white/30 before:ring-inset",
		company: "text-white",
		footerText: "text-white",
		paypassIcon: "text-white",
		cardTypeRoot: "bg-white/10"
	},
	"gray-strip": {
		root: "bg-neutral-100 before:pointer-events-none before:absolute before:inset-0 before:z-1 before:rounded-[inherit] before:mask-linear-135 before:mask-linear-to-white/20 before:ring-1 before:ring-white/30 before:ring-inset",
		company: "text-neutral-700",
		footerText: "text-white",
		paypassIcon: "text-neutral-400",
		cardTypeRoot: "bg-white/10"
	},
	"gradient-strip": {
		root: "bg-linear-to-b from-[#A5C0EE] to-[#FBC5EC] before:pointer-events-none before:absolute before:inset-0 before:z-1 before:rounded-[inherit] before:mask-linear-135 before:mask-linear-to-white/20 before:ring-1 before:ring-white/30 before:ring-inset",
		company: "text-white",
		footerText: "text-white",
		paypassIcon: "text-white",
		cardTypeRoot: "bg-white/10"
	},
	"salmon-strip": {
		root: "bg-[#F4D9D0] before:pointer-events-none before:absolute before:inset-0 before:z-1 before:rounded-[inherit] before:mask-linear-135 before:mask-linear-to-white/20 before:ring-1 before:ring-white/30 before:ring-inset",
		company: "text-neutral-700",
		footerText: "text-white",
		paypassIcon: "text-white",
		cardTypeRoot: "bg-white/10"
	},
	"gray-strip-vertical": {
		root: "bg-linear-to-br from-white/30 to-transparent before:pointer-events-none before:absolute before:inset-0 before:z-1 before:rounded-[inherit] before:mask-linear-135 before:mask-linear-to-white/20 before:ring-1 before:ring-white/30 before:ring-inset",
		company: "text-white",
		footerText: "text-white",
		paypassIcon: "text-neutral-400",
		cardTypeRoot: "bg-white/10"
	},
	"gradient-strip-vertical": {
		root: "bg-linear-to-b from-[#FBC2EB] to-[#A18CD1] before:pointer-events-none before:absolute before:inset-0 before:z-1 before:rounded-[inherit] before:mask-linear-135 before:mask-linear-to-white/20 before:ring-1 before:ring-white/30 before:ring-inset",
		company: "text-white",
		footerText: "text-white",
		paypassIcon: "text-white",
		cardTypeRoot: "bg-white/10"
	},
	"salmon-strip-vertical": {
		root: "bg-[#F4D9D0] before:pointer-events-none before:absolute before:inset-0 before:z-1 before:rounded-[inherit] before:mask-linear-135 before:mask-linear-to-white/20 before:ring-1 before:ring-white/30 before:ring-inset",
		company: "text-white",
		footerText: "text-white",
		paypassIcon: "text-white",
		cardTypeRoot: "bg-white/10"
	}
});
var STRIP_TYPES = [
	"transparent-strip",
	"gray-strip",
	"gradient-strip",
	"salmon-strip"
];
var VERTICAL_STRIP_TYPES = [
	"gray-strip-vertical",
	"gradient-strip-vertical",
	"salmon-strip-vertical"
];
var CARD_WITH_COLOR_LOGO = [
	"brand-dark",
	"brand-light",
	"gray-dark",
	"gray-light"
];
var calculateScale = (desiredWidth, originalWidth, originalHeight) => {
	const scale = desiredWidth / originalWidth;
	const scaledWidth = originalWidth * scale;
	const scaledHeight = originalHeight * scale;
	return {
		scale: scale.toFixed(4),
		scaledWidth: scaledWidth.toFixed(2),
		scaledHeight: scaledHeight.toFixed(2)
	};
};
var CreditCard = ({ company = "Untitled.", cardNumber = "1234 1234 1234 1234", cardHolder = "OLIVIA RHYE", cardExpiration = "06/28", type = "brand-dark", className, width }) => {
	const originalWidth = 316;
	const originalHeight = 190;
	const { scale, scaledWidth, scaledHeight } = (0, import_react.useMemo)(() => {
		if (!width) return {
			scale: 1,
			scaledWidth: originalWidth,
			scaledHeight: originalHeight
		};
		return calculateScale(width, originalWidth, originalHeight);
	}, [width]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		style: {
			width: `${scaledWidth}px`,
			height: `${scaledHeight}px`
		},
		className: cx("relative flex", className),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			style: {
				transform: `scale(${scale})`,
				width: `${originalWidth}px`,
				height: `${originalHeight}px`
			},
			className: cx("absolute top-0 left-0 flex origin-top-left flex-col justify-between overflow-hidden rounded-2xl p-4", styles[type].root),
			children: [
				STRIP_TYPES.includes(type) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pointer-events-none absolute inset-x-0 bottom-0 z-0 h-1/2 bg-neutral-800" }),
				VERTICAL_STRIP_TYPES.includes(type) && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "pointer-events-none absolute inset-y-0 right-22 left-0 z-0 bg-neutral-800" }),
				type === "transparent-gradient" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "absolute -top-4 -left-4 grid grid-cols-2 blur-3xl",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-20 rounded-tl-full bg-pink-500 opacity-30 mix-blend-normal" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-20 rounded-tr-full bg-orange-500 opacity-50 mix-blend-normal" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "size-20 rounded-bl-full bg-blue-500 opacity-30 mix-blend-normal" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "bg-green-500 size-20 rounded-br-full opacity-30 mix-blend-normal" })
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative flex items-start justify-between px-1 pt-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: cx("text-md leading-[normal] font-semibold", styles[type].company),
						children: company
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PaypassIcon, { className: styles[type].paypassIcon })]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative flex items-end justify-between gap-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex min-w-0 flex-col gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-end gap-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								style: { wordBreak: "break-word" },
								className: cx("text-xs leading-snug font-semibold tracking-[0.6px] uppercase", styles[type].footerText),
								children: cardHolder
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: cx("ml-auto text-right text-xs leading-[normal] font-semibold tracking-[0.6px] tabular-nums", styles[type].footerText),
								children: cardExpiration
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: cx("text-md leading-[normal] font-semibold tracking-[1px] tabular-nums", styles[type].footerText),
							children: [cardNumber, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "pointer-events-none invisible inline-block w-0 max-w-0 opacity-0",
								children: "1"
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: cx("flex h-8 w-11.5 shrink-0 items-center justify-center rounded", styles[type].cardTypeRoot),
						children: CARD_WITH_COLOR_LOGO.includes(type) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MastercardIcon, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MastercardIconWhite, {})
					})]
				})
			]
		})
	});
};
function BankPrivate() {
	const p = getPrivateBanking();
	const privateMetrics = getPrivateMetrics();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PageShell, {
		eyebrow: "Alta Bank · Private",
		title: "Invitation Only",
		description: "Alta Private is invitation-only private banking within Alta Bank, reserved for Newport's most influential individuals, founders, institutions, and high-balance clients.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BankSubNav, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-4 md:grid-cols-2 lg:grid-cols-4",
				children: privateMetrics.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BankStatCard, {
					label: m.label,
					value: m.value
				}, m.label))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-10 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-start",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Card, {
					className: "border-gold/20 bg-surface-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "font-mono text-[11px] uppercase tracking-[0.24em] text-gold",
							children: "Alta Private"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground",
							children: "Alta Private is invitation-only private banking within Alta Bank, reserved for Newport's most influential individuals, founders, institutions, and high-balance clients. Membership is extended by referral — not open for public application."
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-6 inline-flex rounded-full border border-border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground",
							children: "Applications closed — access extended by invitation only"
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CreditCard, {
					type: "gray-dark",
					width: 340,
					company: "Alta Private",
					cardNumber: "4921 ···· ···· 8842",
					cardHolder: "Whitford Family Office",
					cardExpiration: "09/29"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrivateTierCard, {
						label: "Private Banker",
						value: p.banker,
						detail: p.bankerTitle
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrivateTierCard, {
						label: "Relationship Tier",
						value: p.tier
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrivateTierCard, {
						label: "Private Card",
						value: p.card,
						detail: p.cardLimit
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrivateTierCard, {
						label: "Priority Lending",
						value: p.lending
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrivateTierCard, {
						label: "Private Negotiated CDs",
						value: "Active placements",
						detail: p.cds
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrivateTierCard, {
						label: "Liquidity Line",
						value: p.liquidityLine
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrivateTierCard, {
						label: "Invitation-Only Access",
						value: "By referral",
						detail: "Not open for public application"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Section, {
				title: "Private Benefits",
				className: "mt-12",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2",
					children: [
						"Dedicated private banker",
						"Same-day NCC-Net wire priority",
						"Negotiated deposit terms",
						"Standby liquidity facilities",
						"Concierge settlement support",
						"Integrated Alta Terminal access"
					].map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "bg-surface-1 px-6 py-4 text-[14px]",
						children: item
					}, item))
				})
			})
		]
	});
}
//#endregion
export { BankPrivate as component };
