import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { useAssetForm } from "./hooks/useAssetForm";
import AssetFormFields from "./components/AssetFormFields";
import MaintenanceScheduleForm from "./components/MaintenanceScheduleForm";
import AssetWorkOrdersTable from "./components/AssetWorkOrderTable";
import { useRedirectOnFacilityChange } from "../../hooks/useRedirectOnFacilityChange";
import { useUser } from "../../context/UserContext";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const formatCurrency = (value: number | null | undefined) =>
  typeof value === "number" ? currencyFormatter.format(value) : "N/A";

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "N/A";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleString();
};

const formatScalar = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "N/A";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
};

const EditAssetPage: React.FC = () => {
  const { id: assetId } = useParams();
  const { user } = useUser();
  useRedirectOnFacilityChange();
  const navigate = useNavigate();

  const isReadOnly = user?.role === "customer";

  const {
    asset,
    isLoading,
    isSaving,
    error,
    lifecycle,
    lifecycleError,
    isLifecycleLoading,
    handleChange,
    updateField,
    saveAsset,
  } = useAssetForm(assetId || "");

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

          <section className="bg-white border border-gray-200 shadow rounded-xl overflow-hidden">
            <div className="px-4 py-3 text-left text-lg font-semibold text-gray-800 border-b border-gray-200">
              Lifecycle Metrics
            </div>
            <div className="p-4 space-y-4">
              {isLifecycleLoading && <p className="text-sm text-gray-600">Loading lifecycle metrics...</p>}
              {!isLifecycleLoading && lifecycleError && (
                <p className="text-sm text-red-600">Unable to load lifecycle metrics.</p>
              )}
              {!isLifecycleLoading && !lifecycleError && lifecycle && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div><strong>Asset ID:</strong> {lifecycle.assetId}</div>
                    <div><strong>Template ID:</strong> {lifecycle.templateId || "N/A"}</div>
                    <div><strong>Total Maintenance Cost:</strong> {formatCurrency(lifecycle.metrics.totalMaintenanceCost)}</div>
                    <div><strong>Current Book Value:</strong> {formatCurrency(lifecycle.metrics.currentBookValue)}</div>
                    <div><strong>Projected Annual Maintenance:</strong> {formatCurrency(lifecycle.metrics.projectedAnnualMaintenance)}</div>
                    <div><strong>Annual Depreciation:</strong> {formatCurrency(lifecycle.metrics.annualDepreciation)}</div>
                    <div><strong>Years in Service:</strong> {formatScalar(lifecycle.metrics.yearsInService)}</div>
                    <div><strong>Replacement Recommended:</strong> {lifecycle.metrics.replacementRecommended ? "Yes" : "No"}</div>
                    <div><strong>Replacement Reason:</strong> {lifecycle.metrics.replacementReason || "N/A"}</div>
                    <div><strong>Computed At:</strong> {formatDateTime(lifecycle.metrics.computedAt)}</div>
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-gray-800 mb-2">Purchase Snapshot</h3>
                    {!lifecycle.purchase && <p className="text-sm text-gray-600">No purchase data found.</p>}
                    {lifecycle.purchase && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                        {Object.entries(lifecycle.purchase).map(([key, value]) => (
                          <div key={key}>
                            <strong>{key}:</strong> {formatScalar(value)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </section>

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
