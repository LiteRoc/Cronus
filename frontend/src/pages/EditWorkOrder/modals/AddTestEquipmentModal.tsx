import React, { useState } from "react";
import Modal from "../../../components/Modal"
import { Asset  } from "@/types";
import { FormCard, Button, Label, Select } from "@/components/ui";
import { showSuccess, showError } from "@/utils/toastUtils";

interface AddTestEquipmentModalProps {
  equip: Asset[];
  onAttachEquip: (equipId: string) => Promise<void>;
  onClose: () => void;
}

const AddTestEquipmentModal: React.FC<AddTestEquipmentModalProps> = ({ equip, onAttachEquip, onClose }) => {
  const [selectedId, setSelectedId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    if (!selectedId) return;
    setIsSaving(true);
    try {
      await onAttachEquip(selectedId);
      showSuccess("Test Equip attached");
      onClose();
    } catch (err) {
      console.error("Failed to attach Test Equip", err);
      showError("Unable to attach Test Equip, Try again");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Select Test Equipment">
      <FormCard title="Test Equipment">
        <div className="space-y-4">
          <div>
            <Label htmlFor="test-equipment" required>Select Test Equipment</Label>
            <Select
              label="Select Equipment"
              id="test-equipment"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              required
            >
              <option value=""> -- Choose Test Equipment --</option>
              {equip.map((eq) => (
                <option key={eq._id} value={eq._id}>
                  {eq.ctrlNumber} - {eq.manufacturer} - {eq.model}
                </option>
              ))}
            </Select>
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
  );
};
export default AddTestEquipmentModal;