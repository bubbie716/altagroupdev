import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ExchangeMarketSnapshotChartProps = {
  data: { t: number; v: number }[];
};

export default function ExchangeMarketSnapshotChart({ data }: ExchangeMarketSnapshotChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 4 }}>
        <defs>
          <linearGradient id="nsxFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
        <XAxis
          dataKey="t"
          tickLine={false}
          axisLine={false}
          stroke="var(--muted-foreground)"
          fontSize={10}
          minTickGap={56}
          tickMargin={8}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          stroke="var(--muted-foreground)"
          fontSize={10}
          width={48}
          tickMargin={4}
          tickFormatter={(value: number) =>
            value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)
          }
        />
        <Tooltip
          contentStyle={{
            background: "var(--surface-2)",
            border: "1px solid var(--border-strong)",
            borderRadius: 8,
            fontSize: 11,
          }}
        />
        <Area type="monotone" dataKey="v" stroke="var(--gold)" strokeWidth={1.8} fill="url(#nsxFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
