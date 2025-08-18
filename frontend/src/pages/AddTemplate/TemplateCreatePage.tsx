import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { EquipmentTemplate } from "../../types/types";
import { createTempleteFromDI, createTemplate } from "../../services/templateAPI";

type TemplateFormData = Partial<Omit<EquipmentTemplate, '_id' | 'verified'>> & {
  manufacturer: string;
  model: string;
  description: string;
  equipmentClass: string;
};

const equipmentClassOptions = ["Class I", "Class II", "Class III", "Other"];

const TemplateCreatePage: React.FC = () => {
  const [formData, setFormData] = useState<TemplateFormData>({
    manufacturer: "",
    model: "",
    description: "",
    equipmentClass: "",
    alarm: false,
    hipaa: false,
    autoAddPMProcedure: false,
    requirePmPlan: false,
    excludeFromLifecycle: false,
    excludeFromAEM: false,
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const navigate = useNavigate();

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSyncFromFDA = async () => {
    try {
      if (formData.di) {
        setIsSyncing(true);
        const tpl = await createTempleteFromDI(formData.di);
        console.log("FDA Template Payload:", tpl);
        
        setFormData((prev) => ({
          ...prev,
          ...tpl.template,
          di: tpl.template?.di || prev.di
        }));
        navigate(`/templates/edit/${tpl.template._id}`)
      } else {
        // Send message that di is missing
      }
    } catch (err) {
      console.error("Sync failed", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCreate = async () => {
    const { manufacturer, model, description, equipmentClass } = formData;

    if (!manufacturer || !model || !description || !equipmentClass) {
      alert("Please fill in all required fields (*)");
      return;
    }

    try {
      const payload = {
        ...formData,
        verified: false, // manually created
      };
      const res = await createTemplate(payload);
      navigate(`/templates/edit/${res._id}`);
    } catch (err) {
      console.error("Template creation failed", err);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Create New Template</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label>
          <span className="text-sm font-medium">Manufacturer *</span>
          <input
            type="text"
            value={formData.manufacturer || ""}
            onChange={(e) => handleChange("manufacturer", e.target.value)}
            className="border p-2 rounded w-full"
          />
        </label>

        <label>
          <span className="text-sm font-medium">Model *</span>
          <input
            type="text"
            value={formData.model || ""}
            onChange={(e) => handleChange("model", e.target.value)}
            className="border p-2 rounded w-full"
          />
        </label>

        <label className="col-span-full">
          <span className="text-sm font-medium">Description *</span>
          <textarea
            value={formData.description || ""}
            onChange={(e) => handleChange("description", e.target.value)}
            className="border p-2 rounded w-full"
          />
        </label>

        <label>
          <span className="text-sm font-medium">Equipment Class *</span>
          <select
            value={formData.equipmentClass || ""}
            onChange={(e) => handleChange("equipmentClass", e.target.value)}
            className="border p-2 rounded w-full"
          >
            <option value="">Select</option>
            {equipmentClassOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="text-sm font-medium">Manufacturer PM Frequency (months)</span>
          <input
            type="number"
            value={formData.manufacturerRecommendedPMFrequency || ""}
            onChange={(e) =>
              handleChange("manufacturerRecommendedPMFrequency", parseInt(e.target.value) || undefined)
            }
            className="border p-2 rounded w-full"
          />
        </label>

        <label>
          <span className="text-sm font-medium">DI / UDI</span>
          <input
            type="text"
            value={formData.di || ""}
            onChange={(e) => handleChange("di", e.target.value)}
            className="border p-2 rounded w-full"
          />
          <button
            type="button"
            onClick={handleSyncFromFDA}
            disabled={isSyncing}
            className="text-blue-600 mt-1 hover:underline"
          >
            {isSyncing ? "Syncing..." : "🔄 Sync from FDA"}
          </button>
        </label>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: "Alarm", key: "alarm" },
          { label: "HIPAA", key: "hipaa" },
          { label: "Auto Add PM Procedure", key: "autoAddPMProcedure" },
          { label: "Require PM Plan", key: "requirePmPlan" },
          { label: "Exclude from Lifecycle", key: "excludeFromLifecycle" },
          { label: "Exclude from AEM", key: "excludeFromAEM" },
        ].map((item) => (
          <label key={item.key} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!formData[item.key as keyof TemplateFormData]}
              onChange={(e) => handleChange(item.key as keyof TemplateFormData, e.target.checked)}
            />
            <span className="text-sm">{item.label}</span>
          </label>
        ))}
      </div>

      <div className="flex gap-4 mt-6">
        <button
          onClick={handleCreate}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          ➕ Create
        </button>
        <button
          onClick={() => navigate("/templates")}
          className="px-4 py-2 border rounded hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default TemplateCreatePage;