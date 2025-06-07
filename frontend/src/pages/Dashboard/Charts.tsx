import React from "react";
import { BarChart, PieChart, Bar, Pie, Cell, Tooltip, Legend, ResponsiveContainer, XAxis, YAxis, CartesianGrid } from "recharts";
import { Asset, DashboardData, WorkOrder } from "../../types/types";
import { assetsByStatus, workOrdersByStatus } from "../../services/api";

interface ChartsProps {
  data: DashboardData;
  onFilter: (type: "workOrders" | "assets", items: WorkOrder[] | Asset[]) => void;
  };

const Charts: React.FC<ChartsProps> = ({ data, onFilter }) => {
  const handleChartClick = async (
    type: "workOrders" | "assets",
    event: any
  ) => {
    try {
      let status: string | undefined;

      // Normalize status from event
      if (event?.name) {
        status = event.name;
      } else if (event?.activeLabel) {
        status = event.activeLabel;
      } else if (typeof event === "string") {
        status = event;
      }

      if (!status) {
        console.warn("Could not determine status from event:", event);
        return;
      }

      console.log(`Fetching ${type} with status:`, status);

      if (type === "workOrders") {
        const filteredWorkOrders = await workOrdersByStatus(status);
        onFilter(type, filteredWorkOrders);
      } else if (type === "assets") {
        const filteredAssets = await assetsByStatus(status);
        onFilter(type, filteredAssets);
      }
    } catch (error) {
      console.error(`Error fetching ${type}:`, error);
      alert(`Failed to load ${type}. Please try again.`);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-8">
      {/* Work Orders by Status */}
      <div className="bg-white shadow-md rounded p-4">
        <h2 className="text-xl font-semibold mb-4">Work Orders by Status</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={data.workOrdersByStatus}
            onClick={(e) => { handleChartClick("workOrders", e);  }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="_id" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Assets by Status */}
      <div className="bg-white shadow-md rounded p-4">
        <h2 className="text-xl font-semibold mb-4">Assets by Status</h2>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={[
                { status: "Active", count: data.assetsSummary.activeAssets },
                { status: "Inactive", count: data.assetsSummary.inactiveAssets },
                { status: "Due for Maintenance", count: data.assetsSummary.dueMaintenance },
              ]}
              dataKey="count"
              nameKey="status"
              outerRadius={100}
              fill="#82ca9d"
              onClick={(e) => handleChartClick("assets", e)} // Pass event directly
            >
              {[
                { status: "Active", count: data.assetsSummary.activeAssets },
                { status: "Inactive", count: data.assetsSummary.inactiveAssets },
                { status: "Due for Maintenance", count: data.assetsSummary.dueMaintenance },
              ].map((_, index) => (
                <Cell key={`cell-${index}`} fill={["#0088FE", "#00C49F", "#BB0000"][index % 3]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Parts Inventory */}
      <div className="bg-white shadow-md rounded p-4">
        <h2 className="text-xl font-semibold mb-4">Parts Inventory</h2>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={[{ name: "In Stock", value: data.totalParts }, { name: "Low Stock", value: data.lowStockParts }]}
              dataKey="value"
              nameKey="name"
              outerRadius={100}
              fill="#FF8042"
              onClick={(e) => handleChartClick("assets", e)}
            >
              <Cell fill="#0088FE" />
              <Cell fill="#FF8042" />
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Technician Time Logs */}
      <div className="bg-white shadow-md rounded p-4">
        <h2 className="text-xl font-semibold mb-4">Technician Time Logs</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={data.totalTimeLogged}
            onClick={() => handleChartClick("workOrders", data.totalTimeLogged.toString())}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="_id" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="totalTime" fill="#82ca9d" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default Charts;