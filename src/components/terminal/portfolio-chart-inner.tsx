import { ResponsiveContainer, AreaChart, Area, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { florin } from "@/lib/format/money-display";

export type PortfolioChartInnerProps = {
  data: { t: number; v: number }[];
  gradientId?: string;
  height?: number;
};

export default function PortfolioChartInner({
  data,
  gradientId = "terminalPortfolio",
  height = 280,
}: PortfolioChartInnerProps) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
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
            formatter={(v) => [florin(Number(v)), "Value"]}
          />
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
  );
}
