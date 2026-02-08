// src/pages/Contracts/components/ContractValueChart.tsx

import { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { ContractValueTimelineEvent } from "@/types/ContractValue";

export function ContractValueChart(props: { rows: ContractValueTimelineEvent[] }) {
  const data = useMemo(() => {
    return props.rows.map((r) => ({
      date: new Date(r.effectiveDate).toISOString().slice(0, 10),
      annual: r.annualValueAfter,
    }));
  }, [props.rows]);

  if (!data.length) return null;  

  return (
    <div className="rounded-2xl border p-4">
      <div className="font-semibold mb-3">Annual Value Over Time</div>
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="annual" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
