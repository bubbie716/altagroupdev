import { getCompanies } from "./companies";
import type { CorporateAnnouncement } from "./types";

const announcementsByTicker: Record<string, CorporateAnnouncement[]> = {
  NPC: [
    {
      id: "npc-1",
      ticker: "NPC",
      date: "2026-06-22",
      title: "Harbor District refining capacity expansion",
      body: "Newport Petroleum Corp. confirms a phased expansion of refining capacity at the Harbor District facility, with commissioning targeted for Q1 2027.",
      type: "corporate",
    },
    {
      id: "npc-2",
      ticker: "NPC",
      date: "2026-06-01",
      title: "May 2026 Financial Update",
      body: "Monthly operating metrics and consolidated financial summary for the period ended May 31, 2026.",
      type: "financial",
      attachment: { name: "NPC_May_2026_Financial_Update.pdf", size: "2.4 MB" },
    },
    {
      id: "npc-3",
      ticker: "NPC",
      date: "2026-05-01",
      title: "April 2026 Financial Update",
      body: "Monthly operating metrics and consolidated financial summary for the period ended April 30, 2026.",
      type: "financial",
      attachment: { name: "NPC_April_2026_Financial_Update.pdf", size: "2.2 MB" },
    },
  ],
  ALTB: [
    {
      id: "altb-1",
      ticker: "ALTB",
      date: "2026-06-18",
      title: "Q2 deposit growth update",
      body: "Alta Bank Holdings reports consolidated deposit growth of 4.2% quarter-to-date across retail and business segments.",
      type: "corporate",
    },
    {
      id: "altb-2",
      ticker: "ALTB",
      date: "2026-06-01",
      title: "May 2026 Financial Update",
      body: "Monthly financial summary for Alta Bank Holdings and consolidated banking subsidiaries.",
      type: "financial",
      attachment: { name: "ALTB_May_2026_Financial_Update.pdf", size: "1.8 MB" },
    },
  ],
  MRDN: [
    {
      id: "mrdn-1",
      ticker: "MRDN",
      date: "2026-06-10",
      title: "Meridian Logistics hub expansion",
      body: "Meridian Logistics announces the opening of a new intermodal hub at Meridian Industrial Park.",
      type: "corporate",
    },
    {
      id: "mrdn-2",
      ticker: "MRDN",
      date: "2026-06-01",
      title: "May 2026 Financial Update",
      body: "Monthly freight volumes, revenue per shipment, and consolidated financial summary.",
      type: "financial",
      attachment: { name: "MRDN_May_2026_Financial_Update.pdf", size: "1.6 MB" },
    },
  ],
  AURM: [
    {
      id: "aurm-1",
      ticker: "AURM",
      date: "2026-06-15",
      title: "Production guidance reaffirmed",
      body: "Aurum Mining Trust reaffirms full-year production guidance following Q2 operational review.",
      type: "corporate",
    },
    {
      id: "aurm-2",
      ticker: "AURM",
      date: "2026-06-01",
      title: "May 2026 Financial Update",
      body: "Monthly production report and consolidated financial summary.",
      type: "financial",
      attachment: { name: "AURM_May_2026_Financial_Update.pdf", size: "1.5 MB" },
    },
  ],
  ELRA: [
    {
      id: "elra-1",
      ticker: "ELRA",
      date: "2026-06-19",
      title: "Phase III candidate regulatory update",
      body: "Elara Pharmaceuticals receives Republic FDA-equivalent approval to proceed with Phase III trials.",
      type: "corporate",
    },
  ],
};

function fallbackAnnouncements(ticker: string, companyName: string): CorporateAnnouncement[] {
  return [
    {
      id: `${ticker.toLowerCase()}-fb-1`,
      ticker,
      date: "2026-06-15",
      title: `${companyName} publishes operating update`,
      body: `${companyName} has published its latest operating update to Alta Exchange investors.`,
      type: "corporate",
    },
  ];
}

/** GET /v1/companies/:ticker/announcements */
export function getAnnouncements(ticker: string): CorporateAnnouncement[] {
  const sym = ticker.toUpperCase();
  if (announcementsByTicker[sym]) return announcementsByTicker[sym];

  const company = getCompanies().find((c) => c.symbol === sym);
  if (!company) return [];
  return fallbackAnnouncements(sym, company.name);
}
