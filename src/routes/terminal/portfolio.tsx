import { createFileRoute } from "@tanstack/react-router";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Section, Card } from "@/components/page-shell";
import { TerminalPageShell } from "@/components/terminal/terminal-layout";
import { TerminalStatCard } from "@/components/terminal/terminal-stat-card";
import { HoldingsTable } from "@/components/terminal/holdings-table";
import { PortfolioChart } from "@/components/terminal/portfolio-chart";
import { EmptyPortfolioState } from "@/components/data/empty-portfolio-state";
import {
  florin,
  getHoldings,
  getPortfolioSeries,
  getPortfolioSummary,
  getPortfolioTransactions,
  getSectorAllocation,
} from "@/lib/terminal/api";
import { isUserFinancialMockDataEnabled } from "@/lib/config/data-mode";
import { authBeforeLoad } from "@/lib/auth/guards";

export const Route = createFileRoute("/terminal/portfolio")({
  beforeLoad: authBeforeLoad,
  head: () => ({
    meta: [{ title: "Portfolio — Alta Terminal" }],
  }),
  component: TerminalPortfolio,
});

const allocColors = ["var(--gold)", "var(--primary-glow)", "var(--success)", "#94A3B8", "#475569", "#7C5E2A"];

function TerminalPortfolio() {
  const showMockData = isUserFinancialMockDataEnabled();

  return (
    <TerminalPageShell
      title="Portfolio"
      description={
        showMockData
          ? "Holdings, allocation, performance, and transaction history — simulated preview data."
          : "Holdings, allocation, performance, and transaction history."
      }
    >

      {showMockData ? <TerminalPortfolioMockContent /> : (
        <EmptyPortfolioState title="You do not have any holdings yet." />
      )}
    </TerminalPageShell>
  );
}

function TerminalPortfolioMockContent() {
  const s = getPortfolioSummary();
  const holdings = getHoldings();
  const portfolioSeries = getPortfolioSeries();
  const sectorAllocation = getSectorAllocation();
  const transactions = getPortfolioTransactions();
  const allocationData = holdings.map((h) => ({ name: h.symbol, value: h.value }));

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <TerminalStatCard label="Cash Balance" value={florin(s.cashBalance)} />
        <TerminalStatCard label="Unrealized Gain" value={`+${florin(s.unrealizedGain)}`} accent />
        <TerminalStatCard label="Realized Gain" value={`+${florin(s.realizedGain)}`} />
        <TerminalStatCard label="Total Return" value={`+${s.totalReturn}%`} accent />
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Section title="Performance">
          <Card>
            <PortfolioChart data={portfolioSeries} gradientId="terminalPortfolio" />
          </Card>
        </Section>
        <Section title="Allocation">
          <Card>
            <div className="grid grid-cols-[140px_1fr] gap-4">
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={allocationData} dataKey="value" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="var(--surface-1)">
                      {allocationData.map((_, i) => (
                        <Cell key={i} fill={allocColors[i % allocColors.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 self-center">
                {holdings.map((h, i) => (
                  <div key={h.symbol} className="flex items-center justify-between text-[12px]">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: allocColors[i % allocColors.length] }} />
                      <span className="font-mono">{h.symbol}</span>
                    </span>
                    <span className="tabular text-muted-foreground">{(h.weight * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </Section>
      </div>

      <Section title="Sector Allocation" className="mt-10">
        <Card>
          <div className="space-y-3">
            {sectorAllocation.map((sec) => (
              <div key={sec.sector}>
                <div className="flex justify-between text-[13px]">
                  <span>{sec.sector}</span>
                  <span className="tabular font-mono">{sec.weight.toFixed(1)}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-gold/70" style={{ width: `${sec.weight}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      <Section title="Holdings" className="mt-10">
        <HoldingsTable rows={holdings} />
      </Section>

      <Section title="Transaction History" className="mt-10">
        <Card className="!p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Description</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b border-border/50 last:border-0 hover:bg-surface-2/40">
                  <td className="px-5 py-3 font-mono text-[12px] text-muted-foreground">{t.date}</td>
                  <td className="px-5 py-3">{t.desc}</td>
                  <td className="px-5 py-3 text-muted-foreground">{t.category}</td>
                  <td className={`tabular px-5 py-3 text-right ${t.amount >= 0 ? "ticker-up" : ""}`}>
                    {t.amount >= 0 ? "+" : ""}
                    {florin(t.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </Section>
    </>
  );
}
