// src/pages/ListAsset/components/AssetTable.tsx

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Asset } from "@/types";

interface AssetTableProps {
  assets: Asset[];
}

type SortKey = keyof Pick<Asset, "ctrlNumber" | "model" | "manufacturer" | "status" | "serialNumber">;

const AssetTable: React.FC<AssetTableProps> = ({ assets }) => {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState<SortKey>("ctrlNumber");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      // toggle direction if clicking same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const sortedAssets = [...assets].sort((a, b) => {
    const aVal = (a[sortKey] ?? "").toString().toLowerCase();
    const bVal = (b[sortKey] ?? "").toString().toLowerCase();

    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const renderSortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortDirection === "asc" ? " ▲" : " ▼";
  };

  const renderStatusChip = (status?: string) => {
    if (!status) return null;
    const colorMap: Record<string, string> = {
      Active: "bg-green-100 text-green-800",
      Inactive: "bg-gray-100 text-gray-800",
      Pending: "bg-yellow-100 text-yellow-800",
      Retired: "bg-red-100 text-red-800",
    };
    return (
      <span
        className={`px-2 py-1 text-xs font-semibold rounded-full ${
          colorMap[status] || "bg-gray-200 text-gray-700"
        }`}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
    <table className="w-full table-auto border-collapse border border-gray-300">
      <thead className="bg-gray-100 text-gray-700 sticky top-0 z-10">
        <tr>
          <th
            className="border px-4 py-2 cursor-pointer"
            onClick={() => handleSort("ctrlNumber")}
          >
            Control #{renderSortIndicator("ctrlNumber")}
          </th>
          <th
            className="border px-4 py-2 cursor-pointer"
            onClick={() => handleSort("model")}
          >
            Model{renderSortIndicator("model")}
          </th>
          <th
            className="border px-4 py-2 cursor-pointer"
            onClick={() => handleSort("manufacturer")}
          >
            Manufacturer{renderSortIndicator("manufacturer")}
          </th>
          <th
            className="border px-4 py-2 cursor-pointer"
            onClick={() => handleSort("status")}
          >
            Status{renderSortIndicator("status")}
          </th>
          <th
            className="border px-4 py-2 cursor-pointer"
            onClick={() => handleSort("serialNumber")}
          >
            Serial #{renderSortIndicator("serialNumber")}
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {sortedAssets.map((asset) => (
          <tr
            key={asset._id}
            className="hover:bg-gray-50 cursor-pointer "
            onClick={() => navigate(`/assets/edit/${asset._id}`)}
          >
            <td className="px-3 py-2 font-medium">{asset.ctrlNumber}</td>
            <td className="px-3 py-2 truncate max-w-[150px]">{asset.model}</td>
            <td className="px-3 py-2 truncate max-w-[150px]">{asset.manufacturer}</td>
            <td className="border px-4 py-2">{renderStatusChip(asset.status)}</td>
            <td className="border px-4 py-2">{asset.serialNumber}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
};

export default AssetTable;