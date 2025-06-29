import React, { useEffect, useState } from "react";
import { useFilteredFetcher } from "../../../hooks/useFilterFetcher";
import { useSearchParams } from "react-router-dom";

const FilteredWorkOrderControls: React.FC = () => {
    const { fetchFilteredItems } = useFilteredFetcher();
    const [searchParams, setSearchParams] = useSearchParams();
    const [field, setField] = useState("type");
    const [value, setValue] = useState("");
    const [filters, setFilters] = useState<Record<string, string>>({});

    const statusOptions = ['Open', 'In Progress', 'Closed', 'Overdue'];
    const workOrderTypeOptions = ['Planned Maintenance', 'Corrective Maintenance'];

    const updateFilters = (newFilters: Record<string, string>) => {
        setFilters(newFilters);
        const newParams = new URLSearchParams();
        for (const [key, val] of Object.entries(newFilters)) {
            newParams.set(key, val);
        }
        setSearchParams(newParams); // triggers fetch in parent component
        fetchFilteredItems('workOrders', newFilters);
    };

    const addFilter = () => {
        if (field && value) {
            updateFilters({ ... filters, [field]: value });
            setValue('');
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
    
        fetchFilteredItems("workOrders", cleared);
      };
    
      useEffect(() => {
        const paramObject: Record<string, string> = {};
        for (const [key, val] of searchParams.entries()) {
          paramObject[key] = val;
        }
        setFilters(paramObject);
        fetchFilteredItems("workOrders", paramObject);
      }, []); // run once on mount

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
            <option value="status">Status</option>
            <option value="type">Type</option>
            </select>
        </div>

        <div>
            <label className="block text-sm font-medium">Value</label>

            {field === "status" ? (
            <select
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="border rounded px-2 py-1"
            >
                <option value="">Select Status</option>
                {statusOptions.map((status) => (
                <option key={status} value={status}>
                    {status}
                </option>
                ))}
            </select>
            ) : field === "type" ? (
            <select
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="border rounded px-2 py-1"
            >
                <option value="">Select Type</option>
                {workOrderTypeOptions.map((type) => (
                <option key={type} value={type}>
                    {type}
                </option>
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
                <span>
                    {key}: {val}
                </span>
                <button
                    onClick={() => removeFilter(key)}
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

export default FilteredWorkOrderControls;