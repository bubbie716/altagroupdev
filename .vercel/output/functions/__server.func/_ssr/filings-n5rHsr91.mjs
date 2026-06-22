//#region node_modules/.nitro/vite/services/ssr/assets/filings-n5rHsr91.js
var researchDocuments = [
	{
		title: "Alta Exchange Daily Market Note",
		category: "Market Commentary",
		date: "2026-06-22",
		issuer: "Alta Exchange Research",
		section: "commentary"
	},
	{
		title: "NPC Q2 Operating Update",
		category: "Company Filing",
		date: "2026-06-18",
		issuer: "Newport Petroleum Corp.",
		section: "filings"
	},
	{
		title: "HLOG IPO Prospectus",
		category: "IPO Prospectus",
		date: "2026-06-15",
		issuer: "Harbor Logistics Group",
		section: "prospectuses"
	},
	{
		title: "NSX-100 Methodology",
		category: "Index Methodology",
		date: "2026-06-10",
		issuer: "Alta Exchange Indices",
		section: "notices"
	},
	{
		title: "Republic Market Structure Notice",
		category: "Exchange Notice",
		date: "2026-06-01",
		issuer: "Alta Exchange",
		section: "notices"
	},
	{
		title: "Q2 Republic Economic Outlook",
		category: "Economic Report",
		date: "2026-05-30",
		issuer: "Alta Exchange Research",
		section: "economic"
	},
	{
		title: "ALTB Annual Market Statement",
		category: "Company Filing",
		date: "2026-05-28",
		issuer: "Alta Bank Holdings",
		section: "filings"
	},
	{
		title: "CRWN Pre-Listing Circular",
		category: "IPO Prospectus",
		date: "2026-05-20",
		issuer: "Crown Residential Trust",
		section: "prospectuses"
	}
];
var corporateActions = [
	{
		ticker: "NPC",
		company: "Newport Petroleum Corp.",
		type: "Dividend Declared",
		detail: "ƒ2.10/share",
		category: "dividends",
		date: "2026-06-12"
	},
	{
		ticker: "ALTB",
		company: "Alta Bank Holdings",
		type: "Buyback Authorized",
		detail: "ƒ1.2B",
		category: "buybacks",
		date: "2026-06-08"
	},
	{
		ticker: "MRDN",
		company: "Meridian Logistics",
		type: "Split Proposal",
		detail: "2-for-1 under review",
		category: "splits",
		date: "2026-06-05"
	},
	{
		ticker: "ELRA",
		company: "Elara Pharmaceuticals",
		type: "Merger Notice",
		detail: "Pending shareholder vote",
		category: "mergers",
		date: "2026-05-28"
	},
	{
		ticker: "AURM",
		company: "Aurum Mining Trust",
		type: "Tender Offer",
		detail: "Open",
		category: "tenders",
		date: "2026-06-18"
	},
	{
		ticker: "HWY",
		company: "Halcyon Wireways",
		type: "Dividend Declared",
		detail: "ƒ0.85/share",
		category: "dividends",
		date: "2026-06-01"
	},
	{
		ticker: "NXST",
		company: "Nexstar Defense",
		type: "Buyback Authorized",
		detail: "ƒ420M",
		category: "buybacks",
		date: "2026-05-22"
	}
];
/** GET /v1/filings */
function getFilings(section) {
	if (!section) return researchDocuments;
	return researchDocuments.filter((doc) => doc.section === section);
}
/** GET /v1/corporate-actions */
function getCorporateActions() {
	return corporateActions;
}
//#endregion
export { getFilings as n, getCorporateActions as t };
