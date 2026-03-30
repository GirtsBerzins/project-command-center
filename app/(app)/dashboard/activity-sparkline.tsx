"use client"

import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from "recharts"

interface Props {
  data: { day: string; count: number }[]
}

export function ActivitySparkline({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={80}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
        <defs>
          <linearGradient id="activityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="day" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ fontSize: 12, padding: "4px 8px" }}
          labelStyle={{ fontWeight: 600 }}
        />
        <Area
          type="monotone"
          dataKey="count"
          name="Events"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#activityGrad)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
