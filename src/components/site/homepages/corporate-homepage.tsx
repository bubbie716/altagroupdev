import type { PortfolioDashboardStat } from "@/components/account/portfolio-dashboard";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { AltaLogo, AltaWordmark } from "@/components/alta-logo";
import { SiteNav } from "@/components/site-nav";
import { HomePortfolioPanel } from "@/components/site/homepages/home-portfolio-panel";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { PlatformMetrics } from "@/lib/metrics/platform-metrics";
import { buildHomepagePlatformMetrics } from "@/lib/metrics/governance-metrics";
import { MetricValue } from "@/components/metrics/metric-value";
import {
  assetAllocationFromSnapshot,
} from "@/lib/account/asset-allocation";
import type { HomePortfolioSnapshot } from "@/lib/account/home-portfolio.types";
import { florin, pct } from "@/lib/format/money-display";
import {
  resolveEntitySiteLabel,
  resolveEntitySiteUrl,
} from "@/lib/site/entity-site-url";
import type { SiteKey } from "@/config/sites";
import { ArrowUpRight, ExternalLink } from "lucide-react";

export type CorporateHomepageProps = {
  platformMetrics: PlatformMetrics;
  snapshot?: HomePortfolioSnapshot | null;
};

type Division = {
  siteKey: SiteKey;
  name: string;
  headline: string;
  tag: string;
  desc: string;
  services: string[];
  metric: string;
};

const DIVISIONS: Division[] = [
  {
    siteKey: "bank",
    name: "Alta Bank",
    headline: "Bank Like the 1%",
    tag: "01 · Banking",
    desc: "Personal banking, business accounts, deposits, lending, and treasury for Newport citizens, builders, and institutions.",
    services: ["Deposits", "Business Banking", "Lending", "Treasury Services"],
    metric: "Operational · Personal & business banking",
  },
  {
    siteKey: "terminal",
    name: "Alta Terminal",
    headline: "Invest Like the 1%",
    tag: "02 · Brokerage",
    desc: "Alta’s brokerage and trading platform — portfolios, watchlists, and order tools for Newport investors.",
    services: ["Portfolio", "Watchlists", "Order entry", "Research"],
    metric: "Operational · Brokerage platform",
  },
  {
    siteKey: "ncc",
    name: "NCC",
    headline: "Instant cash settlement",
    tag: "03 · Clearing",
    desc: "Newport Clearing Corporation provides instant cash transfers between participating banks and Alta Terminal. NCC settles cash, not securities trades.",
    services: ["Bank ↔ Terminal cash", "Institution routing", "Settlement accounts"],
    metric: "Operational · Cash settlement network",
  },
];

export function CorporateHomepage({ platformMetrics, snapshot = null }: CorporateHomepageProps) {
  return (
    <div className="flex min-h-full w-full flex-1 flex-col bg-background">
      <SiteNav />
      <Hero snapshot={snapshot} />
      <Divisions />
      <Capabilities metrics={platformMetrics} />
      <ClosingCTA />
    </div>
  );
}

function formatSnapshotChangeLabel(snapshot: HomePortfolioSnapshot) {
  const sign = snapshot.dailyPnL >= 0 ? "+" : "-";
  return `${sign}${florin(Math.abs(snapshot.dailyPnL))} · ${pct(snapshot.dailyPnLPercent)}`;
}

function flatChartSeries<T extends { t: number; v: number; at?: number }>(
  template: T[],
  value: number,
): T[] {
  return template.map((point) => ({ ...point, v: value }));
}

function buildSnapshotPortfolioStats(snapshot: HomePortfolioSnapshot): PortfolioDashboardStat[] {
  const chartTemplate = snapshot.chartData.length > 0 ? snapshot.chartData : [{ t: 0, v: 0 }];
  return [
    {
      label: "Florin Balance",
      value: florin(snapshot.florinBalance),
      currentValue: snapshot.florinBalance,
      chartSeries: snapshot.chartData,
    },
    {
      label: "Investments",
      value: florin(snapshot.portfolioValue),
      currentValue: snapshot.portfolioValue,
      chartSeries: flatChartSeries(chartTemplate, snapshot.portfolioValue),
    },
  ];
}

function Hero({ snapshot }: { snapshot: HomePortfolioSnapshot | null }) {
  const user = useCurrentUser();
  const portfolioLocked = !user;

  const valueProps = [
    { title: "Seamless Banking", desc: "Institutional-grade accounts and treasury." },
    { title: "Invest with Confidence", desc: "Brokerage tools and portfolio access." },
    { title: "Instant Settlement", desc: "Bank ↔ Terminal cash via NCC." },
    { title: "Built for Privacy", desc: "Your data stays yours until you sign in." },
  ];

  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--gradient-hero)" }}
      />
      <div className="pointer-events-none absolute inset-0 hero-grid" />
      <div className="relative mx-auto max-w-[1400px] px-6 pt-32 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center text-center"
        >
          <AltaLogo className="h-16 w-16 text-foreground" />
          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-border bg-surface-1/50 px-3 py-1 type-meta">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
            Alta Group · Three institutions online
          </div>
          <h1 className="mt-10 max-w-[20ch] font-serif text-[clamp(3.5rem,8.5vw,7.5rem)] font-normal leading-[0.94] tracking-[-0.035em]">
            Live Like the 1%
          </h1>
          <p className="mt-7 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">
            The holding company behind Alta Bank, Alta Terminal, and Newport Clearing Corporation —
            banking, brokerage, and clearing as separate institutions.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/structure"
              className="group inline-flex items-center gap-2 rounded-md bg-foreground px-5 py-3 text-[13px] font-medium tracking-wide text-background transition-transform hover:-translate-y-px"
            >
              View Structure
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            <Link
              to="/leadership"
              className="inline-flex items-center gap-2 rounded-md border border-border-strong bg-surface-1/60 px-5 py-3 text-[13px] font-medium tracking-wide text-foreground transition-colors hover:bg-surface-2"
            >
              Leadership
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto mt-20 max-w-[1180px] min-w-0 overflow-hidden"
        >
          <div className="grain-dark animate-rise min-w-0 overflow-hidden rounded-2xl border border-border-strong bg-surface-1/90 p-2 shadow-[var(--shadow-elegant)] backdrop-blur">
            <HomePortfolioPanel
              locked={portfolioLocked}
              snapshot={snapshot}
              buildSnapshotPortfolioStats={buildSnapshotPortfolioStats}
              formatSnapshotChangeLabel={formatSnapshotChangeLabel}
              assetAllocationFromSnapshot={assetAllocationFromSnapshot}
              florin={florin}
            />
          </div>
          {portfolioLocked && (
            <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-4">
              {valueProps.map((item) => (
                <div
                  key={item.title}
                  className="bg-surface-1/70 px-5 py-4 text-left backdrop-blur-sm"
                >
                  <div className="type-meta-accent">{item.title}</div>
                  <p className="mt-2 text-[12.5px] leading-snug text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          )}
          <div
            className="pointer-events-none absolute -inset-x-20 -bottom-20 -z-10 h-60"
            style={{ background: "var(--shadow-glow)" }}
          />
        </motion.div>
      </div>
    </section>
  );
}

function DivisionCard({ division, index }: { division: Division; index: number }) {
  const href = resolveEntitySiteUrl(division.siteKey);
  const hostLabel = resolveEntitySiteLabel(division.siteKey);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col bg-surface-1 p-7 transition-colors duration-300 hover:bg-surface-2"
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.6, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
        className="flex h-full flex-col"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="type-meta">{division.tag}</span>
          <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:text-gold" />
        </div>
        <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-gold/90">
          {hostLabel}
        </div>
        <h3 className="mt-8 text-[26px] font-semibold tracking-tight">{division.headline}</h3>
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">{division.desc}</p>
        <ul className="mt-6 space-y-1.5">
          {division.services.map((service) => (
            <li key={service} className="flex items-center gap-2 text-[12.5px] text-foreground/85">
              <span className="h-px w-3 bg-gold/70" />
              <span>{service}</span>
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-8 font-mono text-[10.5px] uppercase tracking-[0.18em] text-gold">
          {division.metric}
        </div>
      </motion.div>
    </a>
  );
}

function Divisions() {
  return (
    <section className="mx-auto max-w-[1400px] px-6 py-32">
      <div className="mb-16 grid items-end gap-8 md:grid-cols-[1fr_auto]">
        <div>
          <div className="type-eyebrow">01 — Institutions</div>
          <h2 className="mt-4 text-[clamp(2.25rem,4.4vw,3.75rem)] font-semibold leading-[1.0] tracking-[-0.018em]">
            Three subsidiaries. <br />
            <span className="text-muted-foreground">Three dedicated websites.</span>
          </h2>
        </div>
        <p className="max-w-sm text-[14px] leading-relaxed text-muted-foreground">
          Alta Group is the parent. Each institution below is accessed on its own domain — banking,
          brokerage, and clearing as separate experiences.
        </p>
      </div>
      <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2">
        {DIVISIONS.map((division, index) => (
          <DivisionCard key={division.siteKey} division={division} index={index} />
        ))}
      </div>
    </section>
  );
}

function Capabilities({ metrics }: { metrics: PlatformMetrics }) {
  const items = buildHomepagePlatformMetrics(metrics);

  return (
    <section className="border-y border-border bg-surface-1/40">
      <div className="mx-auto max-w-[1400px] px-6 pt-12 pb-6">
        <div className="type-eyebrow">02 — Group</div>
        <h2 className="mt-3 max-w-2xl text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-[1.05] tracking-[-0.018em]">
          Group-wide records.{" "}
          <span className="text-muted-foreground">Drawn directly from the ledger.</span>
        </h2>
      </div>
      <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-px bg-border md:grid-cols-4 [&>*]:min-w-0">
        {items.map((item) => (
          <div key={item.label} className="bg-surface-1/50 px-6 py-12 text-center md:py-16">
            <MetricValue size="hero">{item.value}</MetricValue>
            <div className="mt-3 type-section-title">{item.label}</div>
            {item.sourceLabel ? (
              <div className="mt-2 font-mono text-[9px] uppercase tracking-[0.18em] text-gold/80">
                {item.sourceLabel}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function ClosingCTA() {
  return (
    <section className="mx-auto max-w-[1400px] px-6 py-32">
      <div className="relative overflow-hidden rounded-2xl border border-border-strong bg-surface-1 p-12 md:p-20">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 80% 20%, oklch(0.32 0.072 264 / 0.4), transparent 60%)",
          }}
        />
        <div className="relative grid gap-10 md:grid-cols-[1.4fr_1fr] md:items-end">
          <div>
            <AltaWordmark />
            <h2 className="mt-8 text-[clamp(2.25rem,4.8vw,4.25rem)] font-semibold leading-[1.0] tracking-[-0.018em]">
              Access the platform <br />
              <em className="not-italic text-gradient-gold">trusted by the Republic.</em>
            </h2>
          </div>
          <div className="flex flex-col items-start gap-3">
            <div className="type-section-title">Platform status</div>
            <p className="max-w-sm text-[14px] leading-relaxed text-muted-foreground">
              Alta Bank, NCC cash settlement, and Terminal cash services are live. Brokerage trading
              and market data remain unavailable until those services launch.
            </p>
            <Link
              to="/terminal"
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-foreground px-5 py-3 text-[13px] font-medium tracking-wide text-background transition-transform hover:-translate-y-px"
            >
              Enter Platform
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
