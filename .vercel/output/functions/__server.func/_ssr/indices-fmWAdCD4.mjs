import { a as makeSeries } from "./mock-data-BOQymobG.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/indices-fmWAdCD4.js
var exchangeIndices = [
	{
		symbol: "NSX-100",
		name: "NSX 100 Index",
		value: 18472.31,
		change: .62,
		constituents: 100,
		category: "Broad Market",
		series: makeSeries(60, 18200, 42, 4.8)
	},
	{
		symbol: "NSX-FIN",
		name: "NSX Financials",
		value: 4201.14,
		change: .41,
		constituents: 24,
		category: "Sector",
		series: makeSeries(60, 4150, 12, .9)
	},
	{
		symbol: "NSX-IND",
		name: "NSX Industrials",
		value: 6812.99,
		change: -.18,
		constituents: 38,
		category: "Sector",
		series: makeSeries(60, 6780, 18, -.3)
	},
	{
		symbol: "NSX-EN",
		name: "NSX Energy",
		value: 3904.66,
		change: 1.27,
		constituents: 12,
		category: "Sector",
		series: makeSeries(60, 3860, 14, .8)
	},
	{
		symbol: "NSX-CMP",
		name: "NSX Composite",
		value: 12840.55,
		change: .48,
		constituents: 184,
		category: "Composite",
		series: makeSeries(60, 12700, 28, 2.4)
	},
	{
		symbol: "NSX-SMC",
		name: "NSX Small Cap",
		value: 2184.2,
		change: -.62,
		constituents: 64,
		category: "Small Cap",
		series: makeSeries(60, 2160, 8, -.4)
	}
];
/** GET /v1/indices */
function getIndices() {
	return exchangeIndices;
}
//#endregion
export { getIndices as t };
