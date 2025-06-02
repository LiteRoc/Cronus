import React, { useState, useEffect } from "react";
import { getParts } from "../../../services/api";
import { Part } from "../../../types/types";

interface AddPartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (partId: string, quantity: number) => void;
}

const AddPartModal: React.FC<AddPartModalProps> = ({ isOpen, onClose, onSave }) => {
  const [parts, setParts] = useState<Part[]>([]);
  const [selectedPartId, setSelectedPartId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);

  useEffect(() => {
    if (isOpen) {
      fetchParts();
    }
  }, [isOpen]);

  const fetchParts = async () => {
    try {
      const response = await getParts();
      setParts(response);
    } catch (error) {
      console.error("Failed to fetch parts:", error);
    }
  };

  const handleSave = () => {
    if (selectedPartId && quantity > 0) {
      onSave(selectedPartId, quantity);
      onClose();
    } else {
      alert("Please select a part and set a valid quantity.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-50 flex items-center justify-center">
      <div className="bg-white p-4 rounded shadow-md w-96">
        <h2 className="text-lg font-semibold mb-4">Add Part</h2>
        <div className="form-group mb-4">
          <label className="block font-medium mb-1">Select Part</label>
          <select
            className="border rounded p-2 w-full"
            value={selectedPartId}
            onChange={(e) => setSelectedPartId(e.target.value)}
          >
            <option value="">-- Select Part --</option>
            {parts.map((part) => (
              <option key={part._id} value={part._id}>
                {part.partNumber} - {part.description} (Qty: {part.quantityOnHand})
              </option>
            ))}
          </select>
        </div>
        <div className="form-group mb-4">
          <label className="block font-medium mb-1">Quantity</label>
          <input
            type="number"
            className="border rounded p-2 w-full"
            value={quantity}
            min="1"
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </div>
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 mr-2"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddPartModal;