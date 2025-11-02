import React from "react";
import FilteredWorkOrderControls from "./components/FilteredWorkOrderControls";
import CreateWorkOrderLauncher from "./components/CreateWorkOrderLauncher";
import { useWorkOrders } from "./hooks/useWorkOrders";
import Pagination from "@/components/Pagination";
import WorkOrderTable from "./components/WorkOrderTable";

const FilteredWorkOrderPage: React.FC =() => {

    const { workOrders, totalPages, totalCount, pagination, setPagination, isLoading, error, refresh } = useWorkOrders();

    if (error) return <div className="p-4 text-red-500">Failed to load Work Orders</div>;
    

    return (
        <div className="p-6">
            <h1 className=" text-2xl font-semibold mb-4">Work Orders</h1>

            <div className="p-6">
                <FilteredWorkOrderControls />
            </div>

            <CreateWorkOrderLauncher onCreated={() => refresh()} />

            {isLoading ? <div>Loading Work Orders...</div> : <WorkOrderTable workOrders={workOrders} />}

            <Pagination
                page={pagination.page}
                totalPages={totalPages}
                totalCount={totalCount}
                pageSize={pagination.pageSize}
                onPageChange={(newPage: any) => setPagination({ page: newPage })}
                onPageSizeChange={(newSize: any) =>
                setPagination({ page: 1, pageSize: newSize }) // reset to first page when size changes
                }
            />
        </div>
    );
};

export default FilteredWorkOrderPage;