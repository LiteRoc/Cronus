// src/pages/EditTemplate/TemplateEditPage.tsx

import React, { useState } from "react";
import useSWR from "swr";
import { useParams, useNavigate } from "react-router-dom";

import type { EquipmentTemplate, WithDuplicate } from "@/types";
import {
  getTemplateById,
  getTemplateLifecycle,
  syncTemplate,
  updateTemplate,
  deleteTemplate,
} from "@/services";

import SyncFromFDAModal from "./modals/SyncFromFDAModal";
import DuplicateBanner from "../../components/DuplicateBanner";
import TemplateLifecycleSummaryCard from "./components/TemplateLifecycleSummaryCard";
import { FaArrowLeft } from "react-icons/fa";

const TemplateEditPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState<Partial<EquipmentTemplate>>({});
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [dupMeta, setDupMeta] = useState<{
    duplicateOf?: string;
    warning?: string;
    matchedOn: string[];
  }>({
    duplicateOf: undefined,
    warning: undefined,
    matchedOn: [],
  });

  const {
    data: template,
    error: templateError,
    isLoading: isTemplateLoading,
    mutate: mutateTemplate,
  } = useSWR(id ? ["template", id] : null, ([, templateId]) =>
    getTemplateById(templateId)
  );

  const {
    data: lifecycleSummary,
    error: lifecycleSummaryError,
    isLoading: isLifecycleSummaryLoading,
    mutate: mutateLifecycleSummary,
  } = useSWR(id ? ["template-lifecycle-summary", id] : null, ([, templateId]) =>
    getTemplateLifecycle(templateId)
  );

  React.useEffect(() => {
    if (template) {
      setFormData(template);
    }
  }, [template]);

  const handleChange = (
    field: keyof EquipmentTemplate,
    value: string | number | boolean | null
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!id) return;

    setSaving(true);

    try {
      const res = (await updateTemplate(
        id,
        formData
      )) as WithDuplicate<EquipmentTemplate>;

      setDupMeta({
        duplicateOf: res.duplicateOf,
        warning: res.warning,
        matchedOn: res.matchedOn ?? [],
      });

      await Promise.all([mutateTemplate(), mutateLifecycleSummary()]);
      navigate("/templates");
    } catch (err) {
      console.error("Save failed", err);
      alert("Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!template?._id) return;
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      await deleteTemplate(template._id);
      navigate("/templates");
    } catch (err) {
      console.error("Delete failed", err);
      alert("Delete failed.");
    }
  };

  const handleSyncFromFDA = async (input: string) => {
    try {
      if (!template?._id) return;

      const updatedTemplate = await syncTemplate(template._id, input);
      if (!updatedTemplate) throw new Error("No template returned");

      setFormData(updatedTemplate);
      await mutateTemplate(updatedTemplate, false);
      await mutateLifecycleSummary();

      alert("Template synced successfully from FDA.");
      setIsSyncModalOpen(false);
    } catch (err) {
      console.error("FDA Sync failed", err);
      alert("Sync failed. Check DI/UDI and try again.");
    }
  };

  if (isTemplateLoading) {
    return <div className="p-6">Loading template...</div>;
  }

  if (templateError || !template) {
    return <div className="p-6 text-red-600">Template not found.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Edit Template</h1>
          <p className="text-sm text-gray-500">
            {template.manufacturer} — {template.model}
          </p>
        </div>

        <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => navigate("/templates")}
          className="flex items-center text-blue-600 hover:text-blue-800"
        >
          <FaArrowLeft className="mr-2" />
          Back to Templates
        </button>
      </div>  
      </div>

      <DuplicateBanner
        entity="template"
        selfId={template._id}
        duplicateOf={dupMeta.duplicateOf}
        warning={dupMeta.warning}
        matchedOn={dupMeta.matchedOn}
        onDismiss={() => setDupMeta((m) => ({ ...m, warning: undefined }))}
      />

      <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">
          Template Details
        </h2>

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700 border-t pt-4">
          <ReadOnlyField label="DI" value={template.di} />
          <ReadOnlyField label="Brand" value={template.brandName} />
          <ReadOnlyField label="FDA Code" value={template.fdaProductCode} />
          <ReadOnlyField label="Issuing Agency" value={template.issuingAgency} />
          <ReadOnlyField label="GMDN" value={template.gmdnTerm} />
          <ReadOnlyField label="Class" value={template.equipmentClass} />
        </div>
      </section>

      <TemplateLifecycleSummaryCard
        summary={lifecycleSummary}
        isLoading={isLifecycleSummaryLoading}
        error={lifecycleSummaryError}
      />

      <div className="flex gap-4 mt-6">
        <button
          type="button"
          onClick={handleSave}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          disabled={saving}
        >
          {saving ? "Saving..." : "💾 Save"}
        </button>

        <button
          type="button"
          onClick={() => navigate("/templates")}
          className="px-4 py-2 border rounded hover:bg-gray-100"
        >
          Cancel
        </button>

        {!template.verified && (
          <button
            type="button"
            onClick={() => setIsSyncModalOpen(true)}
            className="text-yellow-600 hover:underline"
          >
            🔄 Sync from FDA
          </button>
        )}

        <button
          type="button"
          onClick={handleDelete}
          className="text-red-600 hover:underline ml-auto"
        >
          🗑 Delete
        </button>
      </div>

      <SyncFromFDAModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onSync={handleSyncFromFDA}
      />
    </div>
  );
};

const ReadOnlyField = ({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) => (
  <div>
    <strong>{label}:</strong> {value || "N/A"}
  </div>
);

export default TemplateEditPage;