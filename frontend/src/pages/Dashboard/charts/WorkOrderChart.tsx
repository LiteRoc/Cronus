import React from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { handleChartClick } from "../../../utils/chartHandlers";
import { WorkOrderSummary } from "../../../types/types";

interface Props {
  workOrdersSummary: WorkOrderSummary;
  onClick: (status: string) => void;
}

const WorkOrderChart: React.FC<Props> = ({ workOrdersSummary, onClick }) => {
  const data = [
    { status: "Open", count: workOrdersSummary.open },
    { status: "Completed", count: workOrdersSummary.completed },
    { status: "Overdue", count: workOrdersSummary.overdue },
  ];

  return (
    <div className="bg-white shadow-md rounded p-4">
      <h2 className="text-xl font-semibold mb-4">Work Orders by Status</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} onClick={(e) => handleChartClick(e, "workOrders", (_type, status) => onClick(status))}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="status" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="count" fill="#8884d8" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default WorkOrderChart;