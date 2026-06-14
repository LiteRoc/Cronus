// src/pages/ListAsset/components/FilterAssetControls.tsx

import React, { useState } from "react";
import useSWR from "swr";
import { fetchManufacturers, fetchModels } from "@/services";
import { useFilteredStore } from "@/hooks/useFilteredStore";
import { Asset, AssetFilters } from "@/types"

const FilteredAssetControls: React.FC = () => {
  const { filters, setFilters, resetFilters } = useFilteredStore<AssetFilters, Asset>();

  const { data: manufacturers = [] } = useSWR("manufacturers", fetchManufacturers);
  const { data: models = [] } = useSWR(
    filters.manufacturer ? ["models", filters.manufacturer] : null,
    ([, manufacturer]) => fetchModels(manufacturer)
  );

  const [field, setField] = useState("manufacturer");
  const [value, setValue] = useState("");

  const toggleBooleanFilter = (key: keyof AssetFilters) => {
    const isActive = filters[key] === "true";

    if (isActive) {
      removeFilter(key);
      return;
    }

    setFilters({
      ...filters,
      [key]: "true",
    });
  };

  const addFilter = () => {
    if (!value) return;

    // merge new filter with existing ones
    setFilters({
      ...filters,
      [field]: value,
    });

    setValue("");
  };

  const removeFilter = (key: keyof AssetFilters) => {
    const { [key]: _, ...remaining } = filters;
    resetFilters();
    setFilters(remaining);
  };

  return (
    <div className="p-4 bg-white rounded shadow mb-6">
      <div className="flex gap-4 items-end mb-4">
        {/* Field selector */}
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
            <option value="ctrlNumber">Ctrl Number</option>
            <option value="manufacturer">Manufacturer</option>
            <option value="model">Model</option>
            <option value="status">Status</option>
            <option value="search">Search</option>
          </select>
        </div>

        {/* Value input */}
        <div>
          <label className="block text-sm font-medium">Value</label>
          {field === "manufacturer" ? (
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="border rounded px-2 py-1"
            >
              <option value="">Select manufacturer</option>
              {manufacturers.map((mfr: string) => (
                <option key={mfr} value={mfr}>
                  {mfr}
                </option>
              ))}
            </select>
          ) : field === "model" ? (
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="border rounded px-2 py-1"
            >
              <option value="">Select model</option>
              {models.map((m: string) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : field === "status" ? (
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="border rounded px-2 py-1"
            >
              <option value="">Select status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Archived">Archived</option>
            </select>
          ) : (
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Search..."
              className="border rounded px-2 py-1"
            />
          )}
        </div>

        {/* Apply Filter */}
        <button
          onClick={addFilter}
          disabled={!value}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Apply Filter
        </button>

        {/* Reset All */}
        <button
          onClick={resetFilters}
          className="ml-auto text-sm text-red-500 hover:underline"
        >
          Reset All
        </button>
      </div>
      {/* Lifecycle Filter Buttons */}
      <div className="border-t pt-4 mt-4">
        <h2 className="text-sm font-semibold mb-2">Lifecycle Filters</h2>

          <div className="flex flex-wrap gap-2">
            <LifecycleFilterButton
              active={filters.replacementRecommended === "true"}
              label="Replacement Recommended"
              onClick={() => toggleBooleanFilter("replacementRecommended" as keyof AssetFilters)}
            />

            <LifecycleFilterButton
              active={filters.ageExceeded === "true"}
              label="Age > Expected Life"
              onClick={() => toggleBooleanFilter("ageExceeded" as keyof AssetFilters)}
            />

            <LifecycleFilterButton
              active={filters.highMaintenance === "true"}
              label="High Maintenance"
              onClick={() => toggleBooleanFilter("highMaintenance" as keyof AssetFilters)}
            />

            <LifecycleFilterButton
              active={filters.ccrAboveBenchmark === "true"}
              label="Above ECRI CCR"
              onClick={() => toggleBooleanFilter("ccrAboveBenchmark" as keyof AssetFilters)}
            />
          </div>
        </div>

      {/* Active filters */}
      {Object.keys(filters).length > 0 && (
        <div className="border-t pt-4">
          <h2 className="text-sm font-semibold mb-2">Filtering By:</h2>
          <ul className="flex flex-wrap gap-2">
            {Object.entries(filters).map(([key, val]) => (
              <li
                key={key}
                className="bg-gray-200 px-3 py-1 rounded-full text-sm flex items-center gap-2"
              >
                <span>
                  {key}: {String(val)}
                </span>
                <button
                  onClick={() => removeFilter( key as keyof AssetFilters)}
                  className="text-red-500"
                >
                  &times;
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const LifecycleFilterButton = ({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-3 py-1 rounded-full text-sm border ${
      active
        ? "bg-blue-600 text-white border-blue-600"
        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
    }`}
  >
    {label}
  </button>
);

export default FilteredAssetControls;