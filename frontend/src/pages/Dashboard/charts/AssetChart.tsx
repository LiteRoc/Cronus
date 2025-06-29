import React from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import { handlePieChartClick } from "../../../utils/chartHandlers";
import { AssetSummary } from "../../../types/types";

interface Props {
  assetSummary: AssetSummary;
  onClick: (status: string) => void;
}

const AssetChart: React.FC<Props> = ({ assetSummary, onClick }) => {
  const data = [
    { name: "Active", value: assetSummary.active },
    { name: "Inactive", value: assetSummary.inactive },
    { name: "Due for Maintenance", value: assetSummary.upcomingMaintenance },
  ];

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28"];

  return (
    <div className="bg-white shadow-md rounded p-4">
      <h2 className="text-xl font-semibold mb-4">Assets by Status</h2>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            outerRadius={100}
            onClick={(e) => handlePieChartClick(e, "assets", (_type, status) => onClick(status))}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AssetChart;