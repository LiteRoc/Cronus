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
    event: any // Raw event object from the chart click
  ) => {
    try {
      if (type === "workOrders") {
        const status = event.name || event; // If `event` is a string, use it directly
        console.log(`Fetching work orders with status: ${status}`);
  
        const filteredWorkOrders = await workOrdersByStatus(status); // Fetch work orders
        //const filteredWorkOrders = await api.get(`/workorders?status=${status}`);
        console.log("Filtered Work Orders:", filteredWorkOrders);
            
        onFilter(type, filteredWorkOrders); // Update filtered data
      } else if (type === "assets") {
        const status = event.name; // Extract the status from the chart slice
        console.log(`Fetching assets with status: ${status}`);
  
        const filteredAssets = await assetsByStatus(status); // Fetch assets
        console.log("Filtered Assets:", filteredAssets);
  
        onFilter(type, filteredAssets); // Update filtered data
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
            onClick={(e) => {
              handleChartClick('workOrders', e.activeLabel); //Pass status as a string
            }}
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