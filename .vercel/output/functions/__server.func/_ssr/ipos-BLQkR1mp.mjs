//#region node_modules/.nitro/vite/services/ssr/assets/ipos-BLQkR1mp.js
var ipoListings = [
	{
		company: "Harbor Logistics Group",
		ticker: "HLOG",
		offeringPrice: "ƒ18",
		sharesOffered: "5,000,000",
		raiseSize: "ƒ90M",
		status: "Subscription Open",
		stage: "open"
	},
	{
		company: "Crown Residential Trust",
		ticker: "CRWN",
		expectedPrice: "ƒ22–ƒ28",
		status: "Bookbuilding",
		stage: "upcoming"
	},
	{
		company: "Aurum Mining Trust",
		ticker: "AURM",
		listingPrice: "ƒ41.10",
		currentPrice: "ƒ51.88",
		returnSinceListing: "+26.2%",
		status: "Listed",
		stage: "recent"
	}
];
/** GET /v1/ipos */
function getIPOs(stage) {
	if (!stage) return ipoListings;
	return ipoListings.filter((ipo) => ipo.stage === stage);
}
//#endregion
export { getIPOs as t };
