import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../../../components/Modal"; // Shared modal
import { addAsset, getAssetTypes } from "../../../services/assetAPI";
import { getTemplates, getTemplateById } from "../../../services/templateAPI";
import { EquipmentTemplate, TemplateListResponse } from "../../../types/types";
import CreateAssetFromUdiModal from "./CreateAssetFromUdiModal";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const CreateAssetModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [kind, setKind] = useState('');
  const [ctrlNumber, setCtrlNumber] = useState('');
  const [macAddress, setMacAddress] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [facility, setFacility] = useState('');
  const [department, setDepartment] = useState('');
  const [locationNote, setLocationNote] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [assetTypes, setAssetTypes] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TemplateListResponse>();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const [isUdiModalOpen, setIsUdiModalOpen] = useState(false);

  useEffect(() => {
    async function fetchTemplates() {
      const response = await getTemplates(); // GET /templates
      setTemplates(response);
    }
    fetchTemplates();
  }, []);

  /*useEffect(() => {
    getAssetTypes().then((res) => {
        setAssetTypes(res);
    }).catch((err) => {
        console.error('Error fetching asset types:', err);
        setAssetTypes(['GenericAsset']); // fallback
    });
    }, []);*/

    useEffect(() => {
      const selected = templates?.templates.find(t => t._id === selectedTemplateId);
      if (selected) {
        setKind(selected.kind || 'GenericAsset');
        setManufacturer(selected.manufacturer || '');
        setModel(selected.model || '');
      }
    }, [selectedTemplateId]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitting) return;

    setSubmitting(true);

    try {
      let templates: EquipmentTemplate | null = null;

      if (selectedTemplateId) {
        const res = await getTemplateById(selectedTemplateId);
        templates = res;
      }

      // Build payload from state
      const base = {
        templateId: selectedTemplateId,
        kind, manufacturer, model, ctrlNumber,                    // required by base schema
        facility, department, locationNote,
        ...(serialNumber ? { serialNumber } : {}),
      };

      // Add kind-specific fields
      const payload =
        kind === 'TempSensor'
          ? {
              ...base,
              // normalize MAC a bit client-side to help users
              macAddress: macAddress
                .trim()
                .replace(/[-;.\s]/g, ':')
                .toUpperCase(),
            }
          : base;

      const res = await addAsset(payload);
      const id = res?.asset?._id ?? res?._id;

      if (!id) throw new Error('No asset id returned from server');

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

          {/*<div>
            <label className="block text-sm font-medium">Asset Type</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="border rounded px-3 py-2 w-full"
              required
            >
              <option value="">-- Select Type --</option>
              {assetTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>*/}

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
          
          {/* Optional for TempSensors */}
          <div>
            <label className="block text-sm font-medium">
              Serial Number {kind === 'TempSensor' && <span className="text-gray-400">(optional)</span>}
            </label>
            <input
              type="text"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              className="border rounded px-3 py-2 w-full"
              required={kind !== 'TempSensor'}   // 🔑 toggles required
            />
          </div>
          
          {/*  or I could do it this way */}
          {/* Serial Number (not for TempSensor) */}
          {/*{kind !== 'TempSensor' && (
            <div>
              <label className="block text-sm font-medium">Serial Number</label>
              <input
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                className="border rounded px-3 py-2 w-full"
                required     // required for non-TempSensor kinds
              />
            </div>
          )}*/}


          {/* MAC Address only if TempSensor */}
          {kind === 'TempSensor' && (
            <>
              <label className="block text-sm font-medium">MAC Address</label>
              <input
                type="text"
                value={macAddress}
                onChange={(e) => setMacAddress(e.target.value)}
                className="border rounded px-3 py-2 w-full"
                required
              />
            </>
          )}

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