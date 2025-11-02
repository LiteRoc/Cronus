//src/pages/EditWorkOrder/modals/AddProcedureModal.tsx

import React, { useState } from "react";
import Modal from "@/components/Modal";
import { Procedure } from "@/types";
import { Button } from "@/components/ui/button";
import { FormCard } from "@/components/ui";
import { showSuccess, showError } from "@/utils/toastUtils";

interface AddProcedureModalProps {
  procedures: Procedure[];
  onAttachProcedure: (procedureId: string) => Promise<void>;
  onClose: () => void;
}

const AddProcedureModal: React.FC<AddProcedureModalProps> = ({ procedures, onAttachProcedure, onClose }) => {
  const [selectedId, setSelectedId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    if (!selectedId) return;
    setIsSaving(true);
    try {
      await onAttachProcedure(selectedId);
      showSuccess("Procedure attached successfully");
      onClose();
    } catch (err) {
      console.error("Failed to attach procedure:", err);
      showError("Unable to attach procedure. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Attach Procedure">
      <FormCard title="Procedure">
        <div className="space-y-4">
          <div>
            <label htmlFor="procedureSelect">Select Procedure</label>
            <select
              id="procedureSelect"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="border p-2 rounded w-full"
              disabled={isSaving}
            >
              <option value="">-- Choose a procedure --</option>
              {procedures.map((proc) => (
                <option key={proc._id} value={proc._id}>
                  {proc.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex space-x-4 pt-2">
            <Button onClick={handleSubmit} disabled={!selectedId || isSaving}>
              Attach
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

export default AddProcedureModal;