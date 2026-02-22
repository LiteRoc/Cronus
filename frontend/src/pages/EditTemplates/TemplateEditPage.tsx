import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { EquipmentTemplate, TemplateLifecycleBenchmarks, TemplateLifecycleResponse, WithDuplicate } from "@/types";
import { getTemplateById, getTemplateLifecycle, syncTemplate, updateTemplate, deleteTemplate } from "@/services";
import SyncFromFDAModal from "./modals/SyncFromFDAModal";
import DuplicateBanner from "../../components/DuplicateBanner";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const formatCurrency = (value: number | null | undefined) =>
  typeof value === "number" ? currencyFormatter.format(value) : "N/A";

const formatScalar = (value: number | null | undefined) =>
  typeof value === "number" ? String(value) : "N/A";

const BenchmarksCard: React.FC<{ title: string; data: TemplateLifecycleBenchmarks }> = ({ title, data }) => (
  <div className="border border-gray-200 rounded-lg p-3">
    <h4 className="font-semibold text-gray-800 mb-2">{title}</h4>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
      <div><strong>Sample Assets:</strong> {data.sampleAssets}</div>
      <div><strong>Sample WOs (Annual):</strong> {data.sampleWOsAnnual}</div>
      <div><strong>Sample WOs (Lifetime):</strong> {data.sampleWOsLifetime}</div>
      <div><strong>Avg Annual Maintenance:</strong> {formatCurrency(data.avgAnnualMaintenance)}</div>
      <div><strong>Median Annual Maintenance:</strong> {formatCurrency(data.medianAnnualMaintenance)}</div>
      <div><strong>Avg Lifetime Maintenance:</strong> {formatCurrency(data.avgLifetimeMaintenance)}</div>
    </div>
  </div>
);

const TemplateEditPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<EquipmentTemplate | null>(null);
  const [templateLifecycle, setTemplateLifecycle] = useState<TemplateLifecycleResponse | null>(null);
  const [formData, setFormData] = useState<Partial<EquipmentTemplate>>({});
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);

  const [dupMeta, setDupMeta] = useState<{
    duplicateOf?: string;
    warning?: string;
    matchedOn: string[];   // always string[]
  }>({
    duplicateOf: undefined,
    warning: undefined,
    matchedOn: [],         // ✅ ensures no undefined
  });

  useEffect(() => {
    if (id) fetchTemplate(id);
  }, [id]);

  const fetchTemplate = async (id: string) => {
    try {
      const [templateResult, lifecycleResult] = await Promise.allSettled([
        getTemplateById(id),
        getTemplateLifecycle(id),
      ]);

      if (templateResult.status === "fulfilled") {
        setTemplate(templateResult.value);
        setFormData(templateResult.value);
      } else {
        throw templateResult.reason;
      }

      if (lifecycleResult.status === "fulfilled") {
        setTemplateLifecycle(lifecycleResult.value);
        setLifecycleError(null);
      } else {
        setTemplateLifecycle(null);
        setLifecycleError("Unable to load lifecycle metrics.");
      }
    } catch (err) {
      console.error("Error loading template", err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof EquipmentTemplate, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const res = await updateTemplate(id, formData) as WithDuplicate<typeof template>;
      setTemplate(res as any);
      setDupMeta({
        duplicateOf: res.duplicateOf,
        warning: res.warning,
        matchedOn: res.matchedOn ?? [], // ✅ fallback to []
      });

      navigate("/templates");
    } catch (err) {
      console.error("Save failed", err);
    } finally {
      setSaving(false);
    }
  };

  /*const handleSync = async () => {
    if (!template?._id) return;
    try {
      await syncTemplate(template._id);
      fetchTemplate(template._id); // refresh data
    } catch (err) {
      console.error("Sync failed", err);
    }
  };*/

  const handleDelete = async () => {
    if (!template?._id) return;
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      await deleteTemplate(template._id);
      navigate("/templates");
    } catch (err) {
      console.error("Delete failed", err);
    }
  };


  if (loading) return <div className="p-6">Loading...</div>;
  if (!template) return <div className="p-6 text-red-600">Template not found.</div>;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Edit Template</h1>

      <>
        <DuplicateBanner
          entity="template"
          selfId={template?._id ?? ""}
          duplicateOf={dupMeta.duplicateOf}
          warning={dupMeta.warning}
          matchedOn={dupMeta.matchedOn}
          onDismiss={() => setDupMeta((m) => ({ ...m, warning: undefined }))}
        />
        {/* form... */}
      </>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Manufacturer</label>
          <input
            type="text"
            value={formData.manufacturer || ""}
            onChange={(e) => handleChange("manufacturer", e.target.value)}
            className="border p-2 rounded w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Model</label>
          <input
            type="text"
            value={formData.model || ""}
            onChange={(e) => handleChange("model", e.target.value)}
            className="border p-2 rounded w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Description</label>
          <textarea
            value={formData.description || ""}
            onChange={(e) => handleChange("description", e.target.value)}
            className="border p-2 rounded w-full"
          />
        </div>

        {/* Read-Only FDA Fields */}
        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
          <div><strong>DI:</strong> {template.di || "N/A"}</div>
          <div><strong>Brand:</strong> {template.brandName || "N/A"}</div>
          <div><strong>FDA Code:</strong> {template.fdaProductCode || "N/A"}</div>
          <div><strong>Issuing Agency:</strong> {template.issuingAgency || "N/A"}</div>
          <div><strong>GMDN:</strong> {template.gmdnTerm || "N/A"}</div>
          <div><strong>Class:</strong> {template.equipmentClass || "N/A"}</div>
        </div>

        <div className="space-y-3 border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-800">Lifecycle Metrics</h3>
          {lifecycleError && <p className="text-sm text-red-600">{lifecycleError}</p>}
          {!lifecycleError && !templateLifecycle && (
            <p className="text-sm text-gray-600">No lifecycle metrics found.</p>
          )}
          {!lifecycleError && templateLifecycle && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                <div><strong>Template ID:</strong> {templateLifecycle.templateId}</div>
                <div><strong>Expected Life (Years):</strong> {formatScalar(templateLifecycle.lifecycleDefaults.expectedLifeYears)}</div>
                <div><strong>Typical Annual Maintenance:</strong> {formatCurrency(templateLifecycle.lifecycleDefaults.typicalAnnualMaintenance)}</div>
              </div>
              <BenchmarksCard title="Tenant Benchmarks" data={templateLifecycle.benchmarks.tenant} />
              <BenchmarksCard title="Global Benchmarks" data={templateLifecycle.benchmarks.global} />
            </>
          )}
        </div>

        {/* Add Schedule Assignment Component here if needed */}

        <div className="flex gap-4 mt-6">
          <button
            onClick={handleSave}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            disabled={saving}
          >
            {saving ? "Saving..." : "💾 Save"}
          </button>
          <button
            onClick={() => navigate("/templates")}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            Cancel
          </button>

          <button
            onClick={handleDelete}
            className="text-red-600 hover:underline ml-auto"
          >
            🗑 Delete
          </button>
          {!template.verified && (
            <button
              onClick={() => setIsSyncModalOpen(true)}
              className="ml-auto text-yellow-600 hover:underline"
            >
              🔄 Sync from FDA
            </button>
          )}
        </div>

        <SyncFromFDAModal
          isOpen={isSyncModalOpen}
          onClose={() => setIsSyncModalOpen(false)}
          onSync={async (input) => {
            try {
              if (!template?._id) return;
              
              const updatedTemplate = await syncTemplate(template._id, input);
              if (!updatedTemplate) throw new Error("No template returned");
            
              setTemplate(updatedTemplate);
              setFormData(updatedTemplate);
              alert("Template synced successfully from FDA.");
              setIsSyncModalOpen(false);
            } catch (err) {
              console.error("FDA Sync failed", err);
              alert("Sync failed. Check DI/UDI and try again.");
            }
          }}
        />

      </div>
    </div>
  );
};

export default TemplateEditPage;
