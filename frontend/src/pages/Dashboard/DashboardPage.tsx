import React from "react";
import Charts from "./charts/Charts";
import FilteredData from "./FilteredData";
import EditWorkOrderModal from "./modals/EditWorkOrderModal";
import CreateWorkOrderModal from "./modals/CreateWorkOrderModal";
import { useDashboardSummaries } from "../../hooks/useDashboardSummaries";
import { useFilteredData } from "../../hooks/useFilteredData";
import { useSidebarLinks } from "../../hooks/useSidebarLinks";
import { Asset, WorkOrder, Part } from "../../types/types";
import { toast } from "react-toastify";
import { Link, useNavigate } from "react-router-dom";

import { showSuccess, showError } from "../../utils/toastUtils";
import { useWorkOrderActions } from "../../hooks/workorders/useWorkOrderActions";
import { useModalManager } from "../../hooks/useModalManager";

const DashboardPage: React.FC = () => {
  const { filteredData } = useFilteredData();

  // TEMP: mock role — replace with real auth logic later
  const userRole = "admin"; // In the future, pull from AuthContext or JWT
  const links = useSidebarLinks(userRole);

  const { saveWorkOrder, createWorkOrder, deleteWorkOrder } = useWorkOrderActions();

  const {
    editItem,
    selectedAsset,
    showCreateModal,
    openEditModal,
    closeEditModal,
    openCreateModal,
    closeCreateModal,
  } = useModalManager();

  const navigate = useNavigate();

  const {
    workOrdersSummary,
    assetSummary,
    partsSummary,
    technicianPerformance,
    isLoading,
    error,
  } = useDashboardSummaries();

  //console.log({ workOrdersSummary, assetSummary, partsSummary, technicianPerformance });

  const handleEdit = (item: WorkOrder | Asset | Part) => {
    if ("workOrderNumber" in item) {
      openEditModal(item);
      navigate(`/workorders/edit/${item._id}`);
    } else if ("ctrlNumber" in item) {
      openEditModal(item);
      navigate(`/assets/edit/${item._id}`);
    } else if ("partNumber" in item) {
      console.log("Edit Part:", item);
    }
  };

  const handleDelete = (id: string) => deleteWorkOrder(id);

  const handleSave = async (updatedWorkOrder: WorkOrder) => {
    try {
      await saveWorkOrder(updatedWorkOrder)
      closeEditModal();
      showSuccess("Work order saved successfully!");
    } catch (error) {
      console.error("Failed to save work order:", error);
      showError("Failed to save changes.", { autoClose: 6000 });
    }
  };

  const handleCreateWorkOrder = (asset: Asset) => openCreateModal(asset) ;

  const handleCreateWorkOrderFromModal = async (newWorkOrder: WorkOrder) => {
    try {
      await createWorkOrder(newWorkOrder);
      handleCreateWorkOrder;
    } catch (error) {
      console.error("Create failed:", error);
      toast.error("Failed to create work order.");
    }
  };

  const handleCloseModal = () => closeEditModal();
  const handleCloseCreateModal = () => closeCreateModal();

  if (isLoading) return <div>Loading dashboard data...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="flex min-h-screen">

      {/* Sidebar */}
      <aside className="w-64 bg-gray-800 text-white p-4">
        <div className="text-2xl font-bold mb-6">AegisOps</div>
        <nav className="flex flex-col space-y-3">
          {links.map(({ to, label, icon }) => (
            <Link key={to} to={to} className="flex items-center hover:bg-gray-700 p-2 rounded">
              <span className="mr-2">{icon}</span> {label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 bg-gray-100">
        <h1 className="text-3xl font-bold mb-4">Dashboard</h1>

        <Charts
          workOrdersSummary={workOrdersSummary || { open: 0, completed: 0, overdue: 0 }}
          assetSummary={assetSummary || { active: 0, inactive: 0, upcomingMaintenance: 0 }}
          partsSummary={partsSummary || { inStock: 0, lowStock: 0 }}
          technicianPerformance={technicianPerformance || []}
        />

        {filteredData && (
          <FilteredData
            type={filteredData.type}
            items={filteredData.items}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onCreateWorkOrder={handleCreateWorkOrder}
          />
        )}

        {editItem && (
          <EditWorkOrderModal
            workOrder={editItem as WorkOrder}
            onClose={handleCloseModal}
            onSave={handleSave}
          />
        )}

        {showCreateModal && selectedAsset && (
          <CreateWorkOrderModal
            asset={selectedAsset}
            onClose={handleCloseCreateModal}
            onCreate={handleCreateWorkOrderFromModal}
          />
        )}
      </main>
    </div>
  );
};

export default DashboardPage;