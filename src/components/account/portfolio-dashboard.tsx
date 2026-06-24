import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Lock } from "lucide-react";
import { AltaLogo } from "@/components/alta-logo";
import { DiscordSignInButton } from "@/components/auth/auth-gate";
import { cn } from "@/lib/utils";
import { pct } from "@/lib/terminal/api";

export type PortfolioDashboardStat = {
  label: string;
  value: string;
  up?: boolean;
};

export type PortfolioDashboardMover = {
  symbol: string;
  change: number;
};

type ChartPoint = { t: string; v: number };

const LOCKED_BLUR = "blur-[6px]";

export function PortfolioDashboard({
  netWorth,
  changeLabel,
  changePositive = true,
  chartData,
  stats,
  movers,
  gradientId = "portfolioFill",
  showTimeRange = true,
  headerLabel = "Alta Portfolio · Snapshot",
  locked = false,
  signInRedirect = "/",
}: {
  netWorth: string;
  changeLabel: string;
  changePositive?: boolean;
  chartData: ChartPoint[];
  stats: PortfolioDashboardStat[];
  movers: PortfolioDashboardMover[];
  gradientId?: string;
  showTimeRange?: boolean;
  headerLabel?: string;
  /** When true, sensitive values are blurred with a sign-in overlay. */
  locked?: boolean;
  signInRedirect?: string;
}) {
  return (
    <div className="relative rounded-xl bg-background p-5">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-3">
          <AltaLogo className="h-4 w-4" />
          <span className="type-meta">
            {headerLabel}
          </span>
        </div>
        {showTimeRange && (
          <div className={cn("hidden gap-1 md:flex", locked && "opacity-60")}>
            {["1D", "1W", "1M", "3M", "1Y", "ALL"].map((t, i) => (
              <span
                key={t}
                className={`rounded px-2 py-0.5 font-mono text-[10px] ${i === 3 ? "bg-surface-2 text-foreground" : "text-muted-foreground"}`}
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div
        className={cn(
          "grid gap-5 pt-5 lg:grid-cols-[1.6fr_1fr]",
          locked && "pointer-events-none select-none",
        )}
        aria-hidden={locked || undefined}
      >
        <div>
          <div className="flex items-baseline gap-4">
            <div>
              <div className="type-meta">
                Net Worth
              </div>
              <div
                className={cn(
                  "tabular mt-1 text-3xl font-semibold tracking-tight",
                  locked && LOCKED_BLUR,
                )}
              >
                {netWorth}
              </div>
            </div>
            <div
              className={cn(
                "type-finance text-xs",
                changePositive ? "ticker-up" : "ticker-down",
                locked && LOCKED_BLUR,
              )}
            >
              {changeLabel}
            </div>
          </div>
          <div className={cn("mt-4 h-56", locked && LOCKED_BLUR)}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
                <XAxis hide dataKey="t" />
                <YAxis hide domain={["dataMin", "dataMax"]} />
                {!locked && (
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border-strong)",
                      borderRadius: 8,
                      fontSize: 11,
                    }}
                    labelStyle={{ display: "none" }}
                    formatter={(v) => [Number(v).toFixed(2), "Value"]}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="var(--gold)"
                  strokeWidth={1.8}
                  fill={`url(#${gradientId})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {stats.map((k) => (
            <div key={k.label} className="rounded-lg border border-border bg-surface-1 p-3">
              <div className="type-meta-sm">
                {k.label}
              </div>
              <div
                className={cn(
                  "tabular mt-1.5 text-base font-semibold",
                  k.up ? "text-[var(--success)]" : "",
                  locked && LOCKED_BLUR,
                )}
              >
                {k.value}
              </div>
            </div>
          ))}
          <div className="col-span-2 rounded-lg border border-border bg-surface-1 p-3">
            <div className="type-meta-sm">
              Top Movers
            </div>
            <div className="mt-2 space-y-1.5">
              {movers.map((s) => (
                <div key={s.symbol} className="flex items-center justify-between text-[12px]">
                  <span className={cn("font-mono", locked && LOCKED_BLUR)}>{s.symbol}</span>
                  <span
                    className={cn(
                      "tabular",
                      s.change >= 0 ? "ticker-up" : "ticker-down",
                      locked && LOCKED_BLUR,
                    )}
                  >
                    {pct(s.change)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {locked && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-gradient-to-b from-background/55 via-background/70 to-background/80 backdrop-blur-[1px]">
          <div className="mx-auto max-w-md px-6 py-8 text-center">
            <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-full border border-gold/25 bg-[color-mix(in_oklch,var(--gold)_8%,var(--background))] shadow-sm">
              <Lock className="size-[18px] text-gold" strokeWidth={1.75} aria-hidden />
            </div>
            <h3 className="text-lg font-semibold tracking-tight text-foreground">
              Sign in to view your portfolio
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
              Access your net worth, balances, portfolio performance, and more — all in one place.
            </p>
            <div className="mx-auto mt-6 max-w-xs">
              <DiscordSignInButton redirectTo={signInRedirect} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
