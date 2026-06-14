import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "@/components/Modal"; // Shared modal
import { getTemplates, getDepartmentsByFacility, addAsset } from "@/services";
import { Department, TemplateListResponse } from "@/types";
import CreateAssetFromUdiModal from "./CreateAssetFromUdiModal";
import { useFacility } from "@/context/FacilityContext";

interface CreateAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const CreateAssetModal: React.FC<CreateAssetModalProps> = ({ isOpen, onClose, onCreated }) => {
  
  const { selectedFacilityId } = useFacility();

  const navigate = useNavigate();
  
  const [ctrlNumber, setCtrlNumber] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [description, setDescription] = useState("");
  const [serialNumber, setSerialNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const [templates, setTemplates] = useState<TemplateListResponse>();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>("");

  const [isUdiModalOpen, setIsUdiModalOpen] = useState(false);

  useEffect(() => {
    async function fetchTemplates() {
      const response = await getTemplates(); // GET /templates
      setTemplates(response);
    }
    fetchTemplates();
  }, []);

    useEffect(() => {
      const selected = templates?.templates.find(t => t._id === selectedTemplateId);
      if (selected) {
        setManufacturer(selected.manufacturer || '');
        setModel(selected.model || '');
        setDescription(selected.description || '');
      }
    }, [selectedTemplateId]);

    useEffect(() => {
      if (isOpen && selectedFacilityId) {
        getDepartmentsByFacility()
          .then(setDepartments)
          .catch((err) => console.error("Error fetching departments:", err));
      }
    }, [isOpen, selectedFacilityId]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitting) return;

    setSubmitting(true);

    try {
      //let templates: EquipmentTemplate | null = null;

      /*if (selectedTemplateId) {
        const res = await getTemplateById(selectedTemplateId);
        templates = res;
      }*/

      // Build payload from state
      const payload = {
        templateId: selectedTemplateId,
        manufacturer: manufacturer,
        model: model,
        description: description,
        ctrlNumber: ctrlNumber,                    // required by base schema
        facilityId: selectedFacilityId,
        departmentId: selectedDept,
        ...(serialNumber ? { serialNumber } : {}),
      };

      // Add kind-specific fields
      /*const payload =
        kind === 'TempSensor'
          ? {
              ...base,
              // normalize MAC a bit client-side to help users
              macAddress: macAddress
                .trim()
                .replace(/[-;.\s]/g, ':')
                .toUpperCase(),
            }
          : base;*/

      console.log("New Asset:", payload);

      const res = await addAsset(payload);
      const id = res?.asset?._id ?? res?._id;

      if (!id) throw new Error('No asset id returned from server');

      onCreated();
      resetForm();
      onClose();
      navigate(`/assets/edit/${id}`);
    } catch (err: any) {
        const status = err?.response?.status;
        const data = err?.response?.data;

        if (status === 409) {
          alert(`${data?.field ?? 'Control #'} "${data?.value ?? ''}" is already in use.`);
        } else if (status === 400 && data?.details) {
          // show per-field errors if you want
          alert('Validation failed. Please check inputs.');
        } else {
          alert('Failed to create asset.');
        }
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setCtrlNumber("");
    setManufacturer("");
    setModel("");
    setDescription("");
    setSerialNumber("");
    setSelectedDept("");
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="w-3/4 max-w-3xl">
      <div className="bg-white p-6 rounded shadow-lg w-full">
        <h2 className="text-xl font-bold mb-4">Quick Add Asset</h2>
        <form onSubmit={handleSubmit} className="space-y-4">

        <label className="block text-sm font-medium mb-1">Template</label>
          <select
            value={selectedTemplateId || ""}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="border rounded w-full p-2 mb-4"
          >
            <option value="">Select a template...</option>
            {templates?.templates.map((tpl) => (
              <option key={tpl._id} value={tpl._id}>
                {tpl.manufacturer} – {tpl.model}
              </option>
            ))}
          </select>

          <div>
            <label className="block text-sm font-medium">Department</label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="mt-1 block w-full rounded border px-2 py-1"
            >
              <option value="">-- Select Department --</option>
              {departments.map((dept) => (
                <option key={dept._id} value={dept._id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium">Tag#</label>
            <input
              type="text"
              value={ctrlNumber}
              onChange={(e) => setCtrlNumber(e.target.value)}
              className="border rounded px-3 py-2 w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Manufacturer</label>
            <input
              type="text"
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              className="border rounded px-3 py-2 w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="border rounded px-3 py-2 w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border rounded px-3 py-2 w-full"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium">Serial#</label>
            <input
              type="text"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              className="border rounded px-3 py-2 w-full"
              required
            />
          </div>

          <>
            <button onClick={() => setIsUdiModalOpen(true)} className="bg-green-600 text-white px-4 py-2 rounded">
              + Create from UDI
            </button>

            <CreateAssetFromUdiModal
              isOpen={isUdiModalOpen}
              onClose={() => setIsUdiModalOpen(false)}
              onAssetCreated={(asset: any) => {
                console.log("Created asset:", asset);
                // Optionally redirect or refresh list
              }}
            />
          </>

          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Save and Continue
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default CreateAssetModal;