import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import CreateAssetModal from "../AddAsset/modals/CreateAssetModal";
import { useFilteredStore } from "../../hooks/useFilteredStore";
import { useFilteredFetcher } from "../../hooks/useFilterFetcher";
import { isAssetArray } from "../../utils/typeGuards";
import FilteredAssetControls from "./components/FilteredAssetControls"

const FilteredAssetPage: React.FC = () => {
  const { filteredData } = useFilteredStore();
  const { fetchFilteredItems } = useFilteredFetcher();
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get("status");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();

  // Convert search params to query object
  const queryParams: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  useEffect(() => {
    fetchFilteredItems("assets", queryParams);
  }, [searchParams]);

  //console.log("FilteredAssetPage sees:", filteredData);

  //console.log('Filtered items:', filteredData?.items);

  if (!filteredData || filteredData.type !== "assets") {
    return <div className="p-6 text-red-500">No filtered assets available.</div>;
  }

  if (!filteredData || filteredData.type !== "assets" || !isAssetArray(filteredData.items)
    ) {
      return <div className="p-6 text-red-500">No valid asset data found.</div>;
    }

  const assets = filteredData.items;

  if (assets.length === 0) {
    return (
      <div className="p-6 text-gray-500">
        No assets found for status: {status}
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Assets</h1>
      
      <div className="p-6">
        <FilteredAssetControls />
        {/* your table and results below */}
      </div>

      <CreateAssetModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      <div className="flex justify-end mb-4">
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          + Add Asset
        </button>
      </div>

      <table className="w-full table-auto border-collapse border border-gray-300">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-4 py-2">Control #</th>
            <th className="border px-4 py-2">Model</th>
            <th className="border px-4 py-2">Manufacturer</th>
            <th className="border px-4 py-2">Status</th>
            <th className="border px-4 py-2">Serial #</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <tr 
            key={asset._id}
            className="cursor-pointer hover:bg-gray-100"
            onClick={() => navigate(`/assets/edit/${asset._id}`)}
            >
              <td className="border px-4 py-2">{asset.ctrlNumber}</td>
              <td className="border px-4 py-2">{asset.model}</td>
              <td className="border px-4 py-2">{asset.manufacturer}</td>
              <td className="border px-4 py-2">{asset.status}</td>
              <td className="border px-4 py-2">{asset.serialNumber}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-between items-center">
        <button
          disabled={filteredData.currentPage === 1}
          className="px-4 py-2 bg-gray-300 rounded disabled:opacity-50"
          onClick={() => {
            searchParams.set("page", String(filteredData.currentPage! - 1));
            setSearchParams(searchParams);
          }}
        >
          Previous
        </button>
        <span>
          Page {filteredData.currentPage} of {filteredData.totalPages}
        </span>
        <button
          disabled={filteredData.currentPage === filteredData.totalPages}
          className="px-4 py-2 bg-gray-300 rounded disabled:opacity-50"
          onClick={() => {
            searchParams.set("page", String(filteredData.currentPage! + 1));
            setSearchParams(searchParams);
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default FilteredAssetPage