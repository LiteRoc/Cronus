import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAssetForm } from "../../hooks/assets/useAssetForm";
import AssetFormFields from "./components/AssetFormFields";
import MaintenanceScheduleForm from "./components/MaintenanceScheduleForm";
import AssetWorkOrdersTable from "./components/AssetWorkOrderTable";
import CreateWorkOrderButtonWithModal from "./modals/CreateWorkOrderButtonWithModal";

const EditAssetPage: React.FC = () => {
  const { id: assetId } = useParams();
  const navigate = useNavigate();

  const { asset, isLoading, isSaving, error, handleChange, updateField, saveAsset } = useAssetForm(assetId || "");

  if (isLoading) return <div>Loading asset...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!asset) return <div>Asset not found.</div>;

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Edit Asset</h1>
      {asset ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveAsset();
          }}
          className="space-y-4"
        >
          <AssetFormFields asset={asset} onChange={handleChange} />

          {/* Maintenance Schedule */}
            <MaintenanceScheduleForm
              schedule={asset.maintenanceSchedule}
              onChange={updateField}
            />

          {/* Work Orders */}
          <h2 className="text-xl font-semibold mt-6 border-t pt-4">Work Orders</h2>
          <AssetWorkOrdersTable workOrders={asset.workOrders} />

          <CreateWorkOrderButtonWithModal
            asset={asset}
            onCreated={(wo) => {
              console.log("New work order created:", wo);
              // Optionally: update UI or refetch asset if needed
            }}
          />

          <div className="flex space-x-4 mt-4 border-t pt-4">
            <button
              onClick={async () => {
                const success = await saveAsset();
                if (success) {
                  // optionally redirect or show more UI feedback
                }
              }}
              disabled={isSaving}
              >
                {isSaving ? "Saving ..." : "Save Asset"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <p>Loading asset...</p>
      )}
    </div>
  );
};

export default EditAssetPage;