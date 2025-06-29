import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { TechnicianPerformance } from "../../../types/types";

interface Props {
  technicianPerformance: TechnicianPerformance[];
}

const TechnicianChart: React.FC<Props> = ({ technicianPerformance }) => {
  return (
    <div className="bg-white shadow-md rounded p-4 col-span-2">
      <h2 className="text-xl font-semibold mb-4">Technician Time Logs</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={technicianPerformance}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="totalHours" fill="#8884d8" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TechnicianChart;