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
import { CompanyProfileHeader } from "@/components/exchange/company-profile-header";
import { KeyStatsGrid, CompanyMetaGrid } from "@/components/exchange/key-stats-grid";
import { FilingCard } from "@/components/exchange/filing-card";
import { CorporateAnnouncementList } from "@/components/exchange/corporate-announcement-list";
import { getAnnouncements, getCompany } from "@/lib/exchange/api";
import { compact, florin } from "@/lib/mock-data";

export const Route = createFileRoute("/exchange/company/$ticker/")({
  head: ({ params }) => ({
    meta: [{ title: `${params.ticker.toUpperCase()} — Alta Exchange` }],
  }),
  component: CompanyProfilePage,
});

function CompanyProfilePage() {
  const { ticker } = Route.useParams();
  const company = getCompany(ticker);

  if (!company) {
    return (
      <PageShell eyebrow="Alta Exchange" title="Company Not Found" description="No listing found for this ticker.">
        <ExchangeSubNav />
        <Card>
          <p className="text-muted-foreground">Ticker not found in Alta Exchange listings.</p>
          <Link to="/exchange/listings" className="mt-4 inline-block font-mono text-[11px] uppercase tracking-[0.18em] text-gold">
            ← Back to listings
          </Link>
        </Card>
      </PageShell>
    );
  }

  const announcements = getAnnouncements(ticker);

  return (
    <PageShell
      eyebrow="Alta Exchange · Company Profile"
      title={company.name}
      description={company.description}
    >
      <ExchangeSubNav />
      <CompanyProfileHeader company={company} />

      <div className="mt-6 flex justify-end">
        <Link
          to="/exchange/company/$ticker/owner"
          params={{ ticker: company.symbol.toLowerCase() }}
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold hover:underline"
        >
          Issuer portal →
        </Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Section title="Price Chart">
          <Card>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={company.priceSeries}>
                  <defs>
                    <linearGradient id="coFill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
                  <XAxis hide dataKey="t" />
                  <YAxis hide domain={["dataMin", "dataMax"]} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border-strong)",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                    formatter={(v) => [florin(Number(v)), "Price"]}
                  />
                  <Area type="monotone" dataKey="v" stroke="var(--gold)" strokeWidth={1.8} fill="url(#coFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Section>

        <CompanyMetaGrid
          items={[
            { label: "Market Cap", value: `ƒ${compact(company.marketCap)}` },
            { label: "Volume", value: compact(company.volume) },
            { label: "Shares Outstanding", value: compact(company.sharesOutstanding) },
            { label: "CEO / Founder", value: company.ceo },
            { label: "Headquarters", value: company.headquarters },
            { label: "Exchange", value: company.exchange },
          ]}
        />
      </div>

      <Section title="Key Stats" className="mt-10">
        <KeyStatsGrid stats={company.keyStats} />
      </Section>

      <Section
        title="Corporate Announcements"
        className="mt-10"
        action={
          <Link
            to="/exchange/company/$ticker/owner"
            params={{ ticker: company.symbol.toLowerCase() }}
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold hover:underline"
          >
            Issuer portal →
          </Link>
        }
      >
        <CorporateAnnouncementList announcements={announcements} />
      </Section>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Section title="Top Shareholders">
          <Card className="!p-0">
            <div className="w-full overflow-x-auto"><table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left type-meta">
                  <th className="px-5 py-3">Holder</th>
                  <th className="px-5 py-3 text-right">Ownership</th>
                </tr>
              </thead>
              <tbody>
                {company.shareholders.map((h) => (
                  <tr key={h.name} className="border-b border-border/50 last:border-0">
                    <td className="px-5 py-3">{h.name}</td>
                    <td className="tabular px-5 py-3 text-right">{h.pct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </Card>
        </Section>

        <Section title="Corporate Actions">
          <Card>
            <ul className="space-y-4">
              {company.corporateActions.map((a) => (
                <li key={a.action} className="border-b border-border/50 pb-3 last:border-0">
                  <div className="font-medium">{a.action}</div>
                  <div className="mt-1 text-[13px] text-muted-foreground">{a.detail}</div>
                </li>
              ))}
            </ul>
          </Card>
        </Section>
      </div>

      <Section title="Corporate Filings" className="mt-10">
        <div className="grid gap-4 md:grid-cols-2">
          {company.filings.map((f) => (
            <FilingCard
              key={f.title}
              doc={{
                title: f.title,
                category: f.type,
                date: f.date,
                issuer: company.name,
                section: "filings",
              }}
            />
          ))}
        </div>
      </Section>

      <Section title="Recent News" className="mt-10">
        <Card className="!p-0">
          <ul>
            {company.news.map((n) => (
              <li key={n.headline} className="border-b border-border/50 px-5 py-4 last:border-0">
                <div className="font-mono text-[11px] text-muted-foreground">{n.date}</div>
                <div className="mt-1 text-[14px]">{n.headline}</div>
              </li>
            ))}
          </ul>
        </Card>
      </Section>
    </PageShell>
  );
}
