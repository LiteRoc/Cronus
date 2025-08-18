import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../../../components/Modal"; // Shared modal
import { createAssetFromUDI } from "../../../services/templateAPI";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAssetCreated?: (newAsset: any) => void;
}

const CreateAssetFromUdiModal: React.FC<Props> = ({ isOpen, onClose, onAssetCreated }) => {
  const [udi, setUdi] = useState("");
  const [ctrlNumber, setCtrlNumber] = useState("");
  const [facility, setFacility] = useState("");
  const [department, setDepartment] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();  

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");

    console.log("🚀 Submitting asset creation with UDI:", udi);

    try {
      const payload = {
        udi,
        createAsset: true,
        asset: {
          ctrlNumber,
          facility,
          department,
          notes,
        },
      };

      const res = await createAssetFromUDI(payload);
      onAssetCreated?.(res.asset);
      navigate(`/assets/edit/${res.asset._id}`); // Or `/assets/edit/${res.asset._id}` if editing is the default

      onClose();
    } catch (err: any) {
      console.error("UDI Asset creation failed:", err);
      setError(err.response?.data?.error || "Failed to create asset.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Asset from UDI">
        <div>
          <label className="block text-sm font-medium">UDI (or DI)</label>
          <input
            type="text"
            value={udi}
            onChange={(e) => setUdi(e.target.value)}
            required
            className="border rounded px-3 py-2 w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Control Number (Tag#)</label>
          <input
            type="text"
            value={ctrlNumber}
            onChange={(e) => setCtrlNumber(e.target.value)}
            required
            className="border rounded px-3 py-2 w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Facility</label>
          <input
            type="text"
            value={facility}
            onChange={(e) => setFacility(e.target.value)}
            className="border rounded px-3 py-2 w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Department</label>
          <input
            type="text"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="border rounded px-3 py-2 w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="border rounded px-3 py-2 w-full"
          ></textarea>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex justify-end space-x-2 pt-2">
          <button type="button" onClick={onClose} className="bg-gray-300 px-4 py-2 rounded">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={isSubmitting} className="bg-blue-600 text-white px-4 py-2 rounded">
            {isSubmitting ? "Creating..." : "Create Asset"}
          </button>
        </div>
    </Modal>
  );
};

export default CreateAssetFromUdiModal;