import type { IPOListing, IPOStage } from "./types";

const ipoListings: IPOListing[] = [
  {
    company: "Harbor Logistics Group",
    ticker: "HLOG",
    offeringPrice: "ƒ18",
    sharesOffered: "5,000,000",
    raiseSize: "ƒ90M",
    status: "Subscription Open",
    stage: "open",
  },
  {
    company: "Crown Residential Trust",
    ticker: "CRWN",
    expectedPrice: "ƒ22–ƒ28",
    status: "Bookbuilding",
    stage: "upcoming",
  },
  {
    company: "Aurum Mining Trust",
    ticker: "AURM",
    listingPrice: "ƒ41.10",
    currentPrice: "ƒ51.88",
    returnSinceListing: "+26.2%",
    status: "Listed",
    stage: "recent",
  },
];

/** GET /v1/ipos */
export function getIPOs(stage?: IPOStage): IPOListing[] {
  if (!stage) return ipoListings;
  return ipoListings.filter((ipo) => ipo.stage === stage);
}
