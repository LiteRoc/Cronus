import React, { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useFilteredStore } from "../../hooks/useFilteredStore";
import { useFilteredFetcher } from "../../hooks/useFilterFetcher";
import { isWorkOrderArray } from "../../utils/typeGuards";
import FilteredWorkOrderControls from "./components/FilteredWorkOrderControls";
import { formatDate } from "../../utils/DashboardUtils";

const FilteredWorkOrderPage: React.FC =() => {
    const { filteredData } = useFilteredStore();
    const { fetchFilteredItems } = useFilteredFetcher();
    const [searchParams, setSearchParams] = useSearchParams();
    const status = searchParams.get("status");
    const navigate = useNavigate();

    // Convert search params to query object
    const queryParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
        queryParams[key] = value;
    });

    useEffect(() => {
        fetchFilteredItems('workOrders', queryParams);
    }, [searchParams]);

    if (!filteredData || filteredData.type !== 'workOrders') {
        //console.log('filteredData:', filteredData?.items);
        return <div className="p-6 text-red-500">No filtered work orders available.</div>;
    }

    if (!filteredData || filteredData.type !== "workOrders" || !isWorkOrderArray(filteredData.items)
        ) {
          return <div className="p-6 text-red-500">No valid work order data found.</div>;
        }

    const workOrders = filteredData.items;

    if (workOrders.length == 0) {
        return (
            <div className="p-6 text-gray-500">
                No Work Orders for status: {status}
            </div>
        );
    }

    return (
        <div className="p-6">
            <h1 className=" text-2xl font-semibold mb-4">
                Work Orders with Status: <span className="text-blue-600">{status}</span>
            </h1>

            <div className="p-6">
                <FilteredWorkOrderControls />
            </div>

            <table className="w-full table-auto border-collapse border border-blue-300">
                <thead className="bg-blue-100">
                    <tr>
                        <th className="border px-4 py-2">Work Order #</th>
                        <th className="border px-4 py-2">Date</th>
                        <th className="border px-4 py-2">Tag #</th>
                        <th className="border px-4 py-2">Type</th>
                        <th className="border px-4 py-2">Status</th>
                        <th className="border px-4 py-2">Manufacturer</th>
                        <th className="border px-4 py-2">Close Date</th>
                    </tr>
                </thead>
                <tbody>
                    {workOrders.map((wo) => (
                        <tr
                            key={wo._id}
                            className="cursor-pointer hover:bg-gray-100"
                            onClick={() => navigate(`/workorders/edit/${wo._id}`)}
                            >
                                <td className="border px-4 py-2">{wo.workOrderNumber}</td>
                                <td className="border px-4 py-2">{formatDate(wo.requestDate)}</td>
                                <td className="border px-4 py-2">{wo.assetId?.ctrlNumber}</td>
                                <td className="border px-4 py-2">{wo.workOrderType}</td>
                                <td className="border px-4 py-2">{wo.status}</td>
                                <td className="border px-4 py-2">{wo.assetId?.manufacturer}</td>
                                <td className="border px-4 py-2">{formatDate(wo.completionDate as string)}</td>
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

export default FilteredWorkOrderPage;