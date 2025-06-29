import React, { useEffect, useState } from "react";
import Modal from "../../../components/Modal"; // Import the shared Modal component
import { Procedure } from "../../../types/types";
import { getProcedures } from "../../../services/procedureAPI";

interface AddProcedureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (selectedProcedureId: string) => void;
}

const AddProcedureModal: React.FC<AddProcedureModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [selectedProcedureId, setSelectedProcedureId] = useState<string>("");
  const [availableProcedures, setAvailableProcedures] = useState<Procedure[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchProcedures();
    }
  }, [isOpen])

  const fetchProcedures = async () => {
    try {
      const procedures = await getProcedures();
      setAvailableProcedures(procedures)
    } catch (err) {
      console.error("Failed to fetch procedures:", err);
    }
  }

  const handleSave = () => {
    if (selectedProcedureId) {
      onSave(selectedProcedureId); // Call the passed `handleSaveProcedure`
      onClose(); // Close the modal
    } else {
      alert("Please select a procedure before saving.");
    }
  };
  

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select a Procedure">
      <div className="form-group">
        <label htmlFor="procedure">Procedure</label>
        <select
          id="procedure"
          value={selectedProcedureId}
          onChange={(e) => setSelectedProcedureId(e.target.value)}
          className="border p-2 rounded w-full"
        >
          <option value="" disabled>
            Select a Procedure
          </option>
          {availableProcedures.map((procedure) => (
            <option key={procedure._id} value={procedure._id}>
              {procedure.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex justify-end space-x-4 mt-4">
        <button
          onClick={handleSave}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Save
        </button>
        <button
          onClick={onClose}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
};

export default AddProcedureModal;