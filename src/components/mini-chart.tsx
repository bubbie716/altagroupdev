import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";

export function MiniChart({
  data,
  positive = true,
  height = 56,
}: {
  data: { t: number; v: number }[];
  positive?: boolean;
  height?: number;
}) {
  const color = positive ? "var(--success)" : "var(--danger)";
  const id = `g-${positive ? "u" : "d"}-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.6}
          fill={`url(#${id})`}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}