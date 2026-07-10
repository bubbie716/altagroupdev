import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

export type TerminalAllocationPieChartProps = {
  data: { name: string; value: number }[];
  colors: string[];
};

export default function TerminalAllocationPieChart({ data, colors }: TerminalAllocationPieChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          innerRadius={48}
          outerRadius={70}
          paddingAngle={2}
          stroke="var(--surface-1)"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
