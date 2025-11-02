import React from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import { PartsSummary } from "../../../types/types";

interface Props {
  partsSummary: PartsSummary;
}

const PartsChart: React.FC<Props> = ({ partsSummary }) => {
  const data = [
    { name: "Low Stock", value: partsSummary.lowStock },
  ];

  return (
    <div className="bg-white shadow-md rounded p-4">
      <h2 className="text-xl font-semibold mb-4">Parts Inventory</h2>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            outerRadius={100}
          >
            <Cell fill="#00C49F" />
            <Cell fill="#FF8042" />
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PartsChart;