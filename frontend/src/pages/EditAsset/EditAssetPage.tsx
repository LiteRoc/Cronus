import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { useAssetForm } from "./hooks/useAssetForm";
import AssetFormFields from "./components/AssetFormFields";
import MaintenanceScheduleForm from "./components/MaintenanceScheduleForm";
import AssetWorkOrdersTable from "./components/AssetWorkOrderTable";
import { useRedirectOnFacilityChange } from "../../hooks/useRedirectOnFacilityChange";
import { useUser } from "../../context/UserContext";

const EditAssetPage: React.FC = () => {
  const { id: assetId } = useParams();
  const { user } = useUser();
  useRedirectOnFacilityChange();
  const navigate = useNavigate();

  const isReadOnly = user?.role === "customer";

  const { asset, isLoading, isSaving, error, handleChange, updateField, saveAsset } = useAssetForm(assetId || "");

  const handleBack = () => {
    navigate("/assets");
  }

  if (isLoading) return <div>Loading asset...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!asset) return <div>Asset not found.</div>;

  return (
    <div className="container mx-auto p-4">
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={handleBack}
          className="flex items-center text-blue-600 hover:text-blue-800"
        >
          <FaArrowLeft className="mr-2" />
          Back to Assets
        </button>
      </div>

      <h1 className="text-2xl font-semibold mb-4">Edit Asset</h1>
      {asset ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveAsset();
          }}
          className="space-y-4"
        >
          <AssetFormFields asset={asset} handleChange={handleChange} updateField={updateField} isReadOnly={isReadOnly} />

          {/* Maintenance Schedule */}
            <MaintenanceScheduleForm
              asset={asset}
              updateField={updateField}
              isReadOnly={isReadOnly}
            />

          {/* Work Orders */}
          <h2 className="text-xl font-semibold mt-6 border-t pt-4">Work Orders</h2>
          <AssetWorkOrdersTable asset={asset} />

          {!isReadOnly && (
            <div className="flex space-x-4 mt-4 border-t pt-4">
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-slate-500"
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
              onClick={() => navigate("/assets")}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
          )}
          
        </form>
      ) : (
        <p>Loading asset...</p>
      )}
    </div>
  );
};

export default EditAssetPage;