import React, {useState} from "react";
import Modal from '@/components/Modal';
import { Part } from "@/types";
import { Button } from "@/components/ui";
import { FormCard } from "@/components/ui";
import { showSuccess, showError } from "@/utils/toastUtils";

interface AddPartModalProps {
  parts: Part[];
  onAttachPart: (partId: string, quantity: number) => Promise<void>;
  onClose: () => void;
}

const AddPartModal: React.FC<AddPartModalProps> = ({ parts, onAttachPart, onClose }) => {
  const [selectedId, setSelectedId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [isSaving, setIsSaving] = useState(false);

  console.log("🔍 Parts available to select:", parts);

  const handleSubmit = async () => {
    if (!selectedId) return;
    setIsSaving(true);
    try {
      await onAttachPart(selectedId, quantity);
      showSuccess("Part attached successfully");
      onClose();
    } catch (err) {
      console.error("Failed to attach Part", err);
      showError("Unable to attach Part, Try again");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Attach Part">
      <FormCard title="Part">
        <div className="space-y-4">
          <div>
            <label htmlFor="partSelect">Select Part</label>
            <select
              id="partSelect"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="border p-2 rounded w-full"
              disabled={isSaving}
            >
              <option value="">-- Choose a Part --</option>
              {parts.map((part) => (
                <option key={part._id} value={part._id}>
                  {part.partNumber} - {part.description}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity Input */}
          <div>
            <label
              htmlFor="quantity"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Quantity
            </label>
            <input
              id="quantity"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="border p-2 rounded w-full"
              disabled={isSaving}
            />
          </div>

          <div className="flex space-x-4 pt-2">
            <Button onClick={handleSubmit} disabled={!selectedId || isSaving}>
              Add
            </Button>
            <Button onClick={onClose} variant="ghost" disabled={isSaving}>
              Cancel
            </Button>
          </div>
        </div>
      </FormCard>
    </Modal>
  )
};

export default AddPartModal;