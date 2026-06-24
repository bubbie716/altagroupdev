import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageShell, Section, Card } from "@/components/page-shell";
import { ExchangeSubNav } from "@/components/exchange/exchange-sub-nav";
import { CompanyTable } from "@/components/exchange/company-table";
import { IndexCard } from "@/components/exchange/index-card";
import { IPOCard } from "@/components/exchange/ipo-card";
import { CorporateActionTable } from "@/components/exchange/corporate-action-table";
import { FilingCard } from "@/components/exchange/filing-card";
import {
  getCompanies,
  getCorporateActions,
  getFilings,
  getIndices,
  getIPOs,
  getMarketStats,
} from "@/lib/exchange/api";
import { ALTA_EXCHANGE_TAGLINE } from "@/lib/branding/alta-products";
import { indexSeries, pct } from "@/lib/mock-data";

export const Route = createFileRoute("/exchange/")({
  head: () => ({
    meta: [
      { title: "Alta Exchange — The capital markets platform of Newport." },
      { name: "description", content: getMarketStats().description },
    ],
  }),
  component: ExchangeOverview,
});

function ExchangeOverview() {
  const market = getMarketStats();
  const snap = market.snapshot;
  const companies = getCompanies();
  const indices = getIndices();
  const ipos = getIPOs();
  const filings = getFilings();
  const actions = getCorporateActions();

  return (
    <PageShell
      eyebrow="Alta Exchange"
      title={ALTA_EXCHANGE_TAGLINE}
      description="Alta Exchange operates Newport's primary market infrastructure for listings, price discovery, execution, market data, and Alta Terminal."
    >
      <ExchangeSubNav />

      <Section title="Market Snapshot">
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
                  {snap.index.symbol}
                </div>
                <div className="tabular mt-2 text-4xl font-semibold tracking-tight">
                  {snap.index.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div className="ticker-up mt-1 font-mono text-[12px]">
                  +114.62 · {pct(snap.index.change)}
                </div>
              </div>
              <div className="text-right">
                <div className="type-meta">
                  Status
                </div>
                <div className="mt-1 inline-flex items-center gap-2 rounded-full border border-[var(--success)]/30 px-2.5 py-1 text-[11px]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--success)]" />
                  <span className="font-mono uppercase tracking-wide text-[var(--success)]">
                    {snap.status} · {snap.time}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-6 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={indexSeries}>
                  <defs>
                    <linearGradient id="nsxFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="t" tickLine={false} axisLine={false} stroke="var(--muted-foreground)" fontSize={10} />
                  <YAxis tickLine={false} axisLine={false} stroke="var(--muted-foreground)" fontSize={10} />
                  <Tooltip contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border-strong)", borderRadius: 8, fontSize: 11 }} />
                  <Area type="monotone" dataKey="v" stroke="var(--gold)" strokeWidth={1.8} fill="url(#nsxFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <div className="type-section-title">
              Exchange Statistics
            </div>
            <dl className="mt-4 divide-y divide-border/60 text-sm">
              {market.stats.map((s) => (
                <div key={s.label} className="flex items-center justify-between py-2.5">
                  <dt className="text-muted-foreground">{s.label}</dt>
                  <dd className="type-finance text-[12px]">{s.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </Section>

      <Section
        title="Listed Companies"
        className="mt-12"
        action={
          <Link to="/exchange/listings" className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold hover:underline">
            View all →
          </Link>
        }
      >
        <CompanyTable companies={companies.slice(0, 6)} />
      </Section>

      <Section
        title="Indices"
        className="mt-12"
        action={
          <Link to="/exchange/indices" className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold hover:underline">
            All indices →
          </Link>
        }
      >
        <p className="mb-4 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
          NSX indices are benchmark products calculated and published on Alta Exchange.
        </p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {indices.slice(0, 3).map((idx) => (
            <IndexCard key={idx.symbol} index={idx} />
          ))}
        </div>
      </Section>

      <Section
        title="IPO Center Preview"
        className="mt-12"
        action={
          <Link to="/exchange/ipo" className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold hover:underline">
            IPO Center →
          </Link>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          {ipos.map((ipo) => (
            <IPOCard key={ipo.ticker} ipo={ipo} />
          ))}
        </div>
      </Section>

      <Section
        title="Corporate Actions Preview"
        className="mt-12"
        action={
          <Link to="/exchange/actions" className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold hover:underline">
            All actions →
          </Link>
        }
      >
        <CorporateActionTable actions={actions.slice(0, 5)} />
      </Section>

      <Section
        title="Research & Filings Preview"
        className="mt-12"
        action={
          <Link to="/exchange/research" className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold hover:underline">
            Research library →
          </Link>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filings.slice(0, 3).map((doc) => (
            <FilingCard key={doc.title} doc={doc} />
          ))}
        </div>
      </Section>
    </PageShell>
  );
}
