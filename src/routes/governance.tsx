import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Section, Card } from "@/components/page-shell";
import { AltaLogo } from "@/components/alta-logo";
import { SiteNav, SiteFooter } from "@/components/site-nav";
import { Landmark, LineChart, Building2, Coins, Check } from "lucide-react";

export const Route = createFileRoute("/governance")({
  head: () => ({
    meta: [
      { title: "Governance & Structure — Alta Group" },
      {
        name: "description",
        content:
          "Corporate structure of Alta Group N.V. — parent holding company of Alta Bank, Alta Terminal, Alta Exchange, and Newport Clearing Corporation (planned).",
      },
      { property: "og:title", content: "Alta Group — Governance & Structure" },
      {
        property: "og:description",
        content: "The financial holding company behind Newport's banking, terminal, exchange, and clearing infrastructure.",
      },
    ],
  }),
  component: Governance,
});

const divisions = [
  {
    icon: Landmark,
    name: "Alta Bank",
    code: "ALT-BNK",
    tagline: "Bank Like the 1%",
    role: "Banking division",
    desc: "Personal banking, business accounts, deposits, lending, and treasury for Newport citizens, builders, and institutions.",
    services: ["Deposits", "Business Banking", "Lending", "Treasury Services"],
    stats: [
      { k: "Accounts", v: "12,480" },
      { k: "Deposits", v: "ƒ62B" },
      { k: "Status", v: "Active" },
    ],
    status: "Operational",
  },
  {
    icon: LineChart,
    name: "Alta Terminal",
    code: "ALT-TRM",
    tagline: "Invest Like the 1%",
    role: "Portfolio & market interface",
    desc: "Portfolio access, market data, watchlists, analytics, and order entry in one interface.",
    services: ["Portfolio Dashboard", "Market Data", "Watchlists", "Order Entry"],
    stats: [
      { k: "Users", v: "8,240" },
      { k: "Assets viewed", v: "ƒ12.4B" },
      { k: "Status", v: "Active" },
    ],
    status: "Operational",
  },
  {
    icon: Building2,
    name: "Alta Exchange",
    code: "ALT-EXC",
    role: "National market venue",
    desc: "Listings, price discovery, trade execution, and market data for the Republic.",
    services: ["Listings", "Price Discovery", "Trade Execution", "Market Infrastructure"],
    stats: [
      { k: "Listings", v: "184" },
      { k: "Market cap", v: "ƒ428B" },
      { k: "Status", v: "Open" },
    ],
    status: "Operational",
  },
  {
    icon: Coins,
    name: "NCC",
    code: "NCC",
    role: "Newport Clearing Corporation",
    desc: "Planned settlement network for routing, wires, payment rails, account registry, and securities clearing.",
    services: ["Interbank Settlement", "Securities Clearing", "Account Registry", "Payment Network"],
    stats: [
      { k: "Network", v: "NCC-Net" },
      { k: "Coverage", v: "Republic-wide" },
      { k: "Status", v: "Planned" },
    ],
    status: "Planned",
  },
];

function Governance() {
  return (
    <div className="min-h-screen bg-background">
      <SiteNav />
      <div className="mx-auto max-w-[1400px] px-6 pt-14">
        {/* Hero — brand-led hierarchy */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="border-b border-border/60 pb-12"
        >
          <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-gold">
            Governance
          </div>
          <h1 className="mt-5 text-[clamp(3.25rem,8vw,6.5rem)] font-semibold uppercase leading-[0.92] tracking-[-0.02em]">
            Alta Group
          </h1>
          <p className="mt-4 text-[clamp(1.125rem,1.4vw,1.5rem)] font-medium tracking-tight text-foreground">
            Live Like the 1%
          </p>
          <p className="mt-2 text-[clamp(1.125rem,1.4vw,1.5rem)] font-medium tracking-tight text-muted-foreground">
            Corporate Structure &amp; Governance
          </p>
          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            A single parent holding company — Alta Group N.V. — operating the
            regulated entities that constitute the financial infrastructure of
            the Republic of Newport.
          </p>
        </motion.div>

      <main className="py-12">
      <div className="grid gap-6 lg:grid-cols-3 mb-12">
        <Card>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Entity</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight">Alta Group N.V.</div>
          <div className="mt-2 text-sm font-medium tracking-tight text-foreground">Live Like the 1%</div>
          <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Financial Infrastructure Holding
          </div>
        </Card>
        <Card>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Mandate</div>
          <div className="mt-2 text-sm leading-relaxed">
            Operate banking, terminal, exchange, and clearing infrastructure for the Republic of Newport under unified governance.
          </div>
        </Card>
        <Card>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Disclosures</div>
          <div className="mt-2 text-xs leading-relaxed text-muted-foreground">
            All figures simulated for the Newport roleplay economy. Florin-denominated. Not a real-money venue.
          </div>
        </Card>
      </div>

      <Section title="Group hierarchy">
        <div className="paper-grain relative rounded-2xl border border-border-strong bg-surface-1/70 p-12 shadow-elevated md:p-16">
          {/* Parent node */}
          <div className="flex flex-col items-center">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center gap-6 rounded-xl border border-border-strong bg-surface-2 px-12 py-7 shadow-elevated"
            >
              <AltaLogo className="h-12 w-12" />
              <div>
                <div className="text-[28px] font-semibold uppercase tracking-[0.06em] leading-none">
                  Alta Group <span className="text-muted-foreground">N.V.</span>
                </div>
                <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.24em] text-gold">
                  Parent · Financial Infrastructure Holding
                </div>
              </div>
            </motion.div>

            {/* Connector */}
            <div className="relative my-10 h-20 w-full">
              <div className="absolute left-1/2 top-0 h-10 w-px -translate-x-1/2 bg-border-strong" />
              <div className="absolute left-[12.5%] right-[12.5%] top-10 h-px bg-border-strong" />
              <div className="absolute left-[12.5%] top-10 h-10 w-px bg-border-strong" />
              <div className="absolute left-[37.5%] top-10 h-10 w-px bg-border-strong" />
              <div className="absolute left-[62.5%] top-10 h-10 w-px bg-border-strong" />
              <div className="absolute left-[87.5%] top-10 h-10 w-px bg-border-strong" />
            </div>

            {/* Children */}
            <div className="grid w-full gap-6 md:grid-cols-2 lg:grid-cols-4">
              {divisions.map((d, i) => {
                const Icon = d.icon;
                const reserved = d.status !== "Operational";
                return (
                  <motion.div
                    key={d.code}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 + i * 0.08 }}
                    className={`group flex h-full min-h-[24rem] flex-col rounded-xl border border-border bg-background/80 p-8 shadow-card transition-all duration-300 hover:border-border-strong hover:-translate-y-0.5 hover:shadow-elevated ${reserved ? "opacity-85" : ""}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-surface-2 text-gold">
                        <Icon className="size-4" />
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                          {d.code}
                        </span>
                        <span className={`font-mono text-[9px] uppercase tracking-[0.2em] ${reserved ? "text-muted-foreground" : "text-[var(--success)]"}`}>
                          {d.status}
                        </span>
                      </div>
                    </div>
                    <div className="mt-7 text-xl font-semibold tracking-tight">{d.name}</div>
                    {"tagline" in d && d.tagline ? (
                      <div className="mt-2 text-sm font-medium tracking-tight text-foreground">{d.tagline}</div>
                    ) : null}
                    <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                      {d.role}
                    </div>
                    <ul className="mt-7 space-y-3 border-t border-border/60 pt-5">
                      {d.services.map((s) => (
                        <li key={s} className="flex items-center gap-2 text-[13px] leading-relaxed text-foreground/90">
                          <Check className="size-3 shrink-0 text-gold" strokeWidth={2.5} />
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                    <dl className="mt-7 grid grid-cols-3 gap-4 border-t border-border/60 pt-6">
                      {d.stats.map((s) => (
                        <div key={s.k}>
                          <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                            {s.k}
                          </dt>
                          <dd className="mt-1 font-mono text-[11px] tabular">{s.v}</dd>
                        </div>
                      ))}
                    </dl>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </Section>

      <Section title="Institutional Footprint" className="mt-12">
        <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4">
          {[
            { k: "Accounts served", v: "12,480" },
            { k: "Deposits held", v: "ƒ62B" },
            { k: "Listed securities", v: "184" },
            { k: "Exchange market cap", v: "ƒ428B" },
            { k: "Private clients", v: "312" },
            { k: "Business accounts", v: "1,842" },
            { k: "Daily settlement volume", v: "ƒ4.2B" },
            { k: "Payment network", v: "NCC Planned" },
          ].map((f) => (
            <div key={f.k} className="bg-surface-1 p-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {f.k}
              </div>
              <div className="mt-2 font-mono text-[13px] tabular">{f.v}</div>
            </div>
          ))}
        </div>
      </Section>
      </main>
      </div>
      <SiteFooter />
    </div>
  );
}