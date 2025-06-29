import React, { useEffect, useState } from "react";
import { useFilteredFetcher } from "../../../hooks/useFilterFetcher";
import { useSearchParams } from "react-router-dom";
import { fetchManufacturers, fetchModels } from "../../../services/assetAPI";

const FilteredAssetControls: React.FC = () => {
  const { fetchFilteredItems } = useFilteredFetcher();
  const [searchParams, setSearchParams] = useSearchParams();
  const [field, setField] = useState("manufacturer");
  const [value, setValue] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});

  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [models, setModels] = useState<string[]>([]);

  const updateFilters = (newFilters: Record<string, string>) => {
    setFilters(newFilters);
    const newParams = new URLSearchParams();
    for (const [key, val] of Object.entries(newFilters)) {
      newParams.set(key, val);
    }
    setSearchParams(newParams); // triggers fetch in parent component
    fetchFilteredItems("assets", newFilters);
  };

  const addFilter = () => {
    if (field && value) {
      updateFilters({ ...filters, [field]: value });
      setValue("");
    }
  };

  const removeFilter = (keyToRemove: string) => {
    const newFilters = { ...filters };
    delete newFilters[keyToRemove];
    setFilters(newFilters);

    updateFilters(newFilters);
  };

  const resetFilters = () => {
    const cleared = {};
    setFilters(cleared);
    setSearchParams({});

    fetchFilteredItems("assets", cleared);
  };

  useEffect(() => {
    const paramObject: Record<string, string> = {};
    for (const [key, val] of searchParams.entries()) {
      paramObject[key] = val;
    }
    setFilters(paramObject);
    fetchFilteredItems("assets", paramObject);
  }, []); // run once on mount

  useEffect(() => {
    fetchManufacturers().then((res) => {
      setManufacturers(res);
    })
  }, []);

  useEffect(() => {
    if (filters.manufacturer || field === "model") {
      fetchModels(filters.manufacturer || value).then(setModels);
    }
  }, [filters.manufacturer, field]);

  return (
    <div className="p-4 bg-white rounded shadow mb-6">
      <div className="flex gap-4 items-end mb-4">
        <div>
          <label className="block text-sm font-medium">Filter Field</label>
          <select
            value={field}
            onChange={(e) => {
              setField(e.target.value);
              setValue("");
            }}
            className="border rounded px-2 py-1"
          >
            <option value="manufacturer">Manufacturer</option>
            <option value="model">Model</option>
            <option value="status">Status</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Value</label>
          {field === "manufacturer" ? (
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="border rounded px-2 py-1"
            >
              <option value="">Select manufacturer</option>
              {manufacturers.map((mfr) => (
                <option key={mfr} value={mfr}>{mfr}</option>
              ))}
            </select>
          ) : field === "model" ? (
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="border rounded px-2 py-1"
            >
              <option value="">Select model</option>
              {models.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          ) : (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="border rounded px-2 py-1"
            />
          )}
        </div>
        <button
          onClick={addFilter}
          disabled={!value}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
            Apply Filter
        </button>
        <button
          onClick={resetFilters}
          className="ml-auto text-sm text-red-500 hover:underline"
        >
            Reset All
        </button>
      </div>

      {Object.keys(filters).length > 0 && (
        <div className="border-t pt-4">
          <h2 className="text-sm font-semibold mb-2">Filtering By:</h2>
          <ul className="flex flex-wrap gap-2">
            {Object.entries(filters).map(([key, val]) => (
              <li
                key={key}
                className="bg-gray-200 px-3 py-1 rounded-full text-sm flex items-center gap-2"
              >
                <span>{key}: {val}</span>
                <button onClick={() => removeFilter(key)} className="text-red-500">&times;</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default FilteredAssetControls;