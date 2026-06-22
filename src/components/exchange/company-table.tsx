import { Link } from "@tanstack/react-router";
import { Card } from "@/components/page-shell";
import { compact, pct } from "@/lib/mock-data";
import type { ListedCompany } from "@/lib/exchange/types";

export function CompanyTable({ companies }: { companies: ListedCompany[] }) {
  return (
    <Card className="!p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            <th className="px-5 py-3">Ticker</th>
            <th className="px-5 py-3">Company</th>
            <th className="px-5 py-3">Sector</th>
            <th className="px-5 py-3 text-right">Last Price</th>
            <th className="px-5 py-3 text-right">Daily Change</th>
            <th className="px-5 py-3 text-right">Market Cap</th>
            <th className="px-5 py-3 text-right">Volume</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3">Issuer</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((c) => (
            <tr
              key={c.symbol}
              className="border-b border-border/50 last:border-0 transition-colors hover:bg-surface-2/40"
            >
              <td className="px-5 py-3">
                <Link
                  to="/exchange/company/$ticker"
                  params={{ ticker: c.symbol.toLowerCase() }}
                  className="font-mono font-medium hover:text-gold"
                >
                  {c.symbol}
                </Link>
              </td>
              <td className="px-5 py-3">
                <Link
                  to="/exchange/company/$ticker"
                  params={{ ticker: c.symbol.toLowerCase() }}
                  className="hover:text-gold"
                >
                  {c.name}
                </Link>
              </td>
              <td className="px-5 py-3 text-muted-foreground">{c.sector}</td>
              <td className="tabular px-5 py-3 text-right">{c.price.toFixed(2)}</td>
              <td
                className={`tabular px-5 py-3 text-right ${c.change >= 0 ? "ticker-up" : "ticker-down"}`}
              >
                {pct(c.change)}
              </td>
              <td className="tabular px-5 py-3 text-right text-muted-foreground">
                ƒ{compact(c.marketCap)}
              </td>
              <td className="tabular px-5 py-3 text-right text-muted-foreground">
                {compact(c.volume)}
              </td>
              <td className="px-5 py-3 font-mono text-[11px] text-[var(--success)]">{c.status}</td>
              <td className="px-5 py-3">
                <Link
                  to="/exchange/company/$ticker/owner"
                  params={{ ticker: c.symbol.toLowerCase() }}
                  className="font-mono text-[11px] uppercase tracking-[0.14em] text-gold hover:underline"
                >
                  Portal →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
