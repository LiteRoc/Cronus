import React, { useEffect, useState } from 'react';
//import { useFilteredFetcher } from '../hooks/useFilterFetcher';
import apiClient from '../services/apiClient';

interface AssetSelectorProps {
  selected: string[];
  onChange: (selectedIds: string[]) => void;
}

const AssetSelector: React.FC<AssetSelectorProps> = ({ selected, onChange }) => {
  //const { fetchFilteredItems } = useFilteredFetcher();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchAssets = async () => {
    const { data } = await apiClient.get(`/assets`, {
      params: {
        search,
        page: currentPage,
        limit: 10,
      },
    });
    setResults(data.assets || []);
    setTotalPages(data.totalPages || 1);
  };

  useEffect(() => {
    fetchAssets();
  }, [search, currentPage]);

  const toggleSelection = (assetId: string) => {
    if (selected.includes(assetId)) {
      onChange(selected.filter((id) => id !== assetId));
    } else {
      onChange([...selected, assetId]);
    }
  };

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 mb-2">
        <input
          type="text"
          placeholder="Search assets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border px-2 py-1 rounded w-full"
        />
      </div>

      <div className="border rounded max-h-64 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="p-2 text-left">Ctrl #</th>
              <th className="p-2 text-left">Manufacturer</th>
              <th className="p-2 text-left">Model</th>
            </tr>
          </thead>
          <tbody>
            {results.map((asset) => {
                const isSelected = selected.includes(asset._id);
                return (
                <tr
                    key={asset._id}
                    className={`cursor-pointer ${isSelected ? 'bg-blue-100 font-medium' : 'hover:bg-gray-50'}`}
                    onClick={() => toggleSelection(asset._id)}
                >
                    <td className="p-2">{asset.ctrlNumber}</td>
                    <td className="p-2">{asset.manufacturer}</td>
                    <td className="p-2">{asset.model}</td>
                </tr>
                );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between mt-2 text-sm">
        <button
          disabled={currentPage <= 1}
          onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
          className="text-blue-600 disabled:opacity-50"
        >
          Previous
        </button>
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <button
          disabled={currentPage >= totalPages}
          onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
          className="text-blue-600 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default AssetSelector;