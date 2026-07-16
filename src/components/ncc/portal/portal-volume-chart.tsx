import { ResponsiveContainer, AreaChart, Area, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { formatPortalMoney } from "@/components/ncc/portal/portal-status-badge";

export type PortalVolumeChartProps = {
  data: Array<{ date: string; volume: number; count: number }>;
};

export default function PortalVolumeChart({ data }: PortalVolumeChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[12px] text-[#6b7280]">
        No volume in the selected period.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="nccVolume" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0c4d32" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#0c4d32" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#e5e7eb" strokeDasharray="2 4" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip
          contentStyle={{
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 4,
            fontSize: 11,
          }}
          formatter={(value) => [formatPortalMoney(Number(value)), "Volume"]}
          labelFormatter={(label) => String(label)}
        />
        <Area
          type="monotone"
          dataKey="volume"
          stroke="#0c4d32"
          strokeWidth={1.6}
          fill="url(#nccVolume)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
