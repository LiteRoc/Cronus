import React, { useState, useEffect } from "react";
import Modal from "../../../components/Modal"
import { Asset } from "../../../types/types";
import { assetsByStatus } from "../../../services/api";

interface AddTestEquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (testEquipmentId: string) => void;
}

const AddTestEquipmentModal: React.FC<AddTestEquipmentModalProps> = ({
  isOpen,
  onClose,
  onAdd,
}) => {
  const [testEquipment, setTestEquipment] = useState<Asset[]>([]);

  useEffect(() => {
    // Fetch available test equipment
    const fetchTestEquipment = async () => {
      try {
        const response = await assetsByStatus('Active');
        setTestEquipment(response);
      } catch (error) {
        console.error("Error fetching test equipment:", error);
      }
    };

    if (isOpen) {
      fetchTestEquipment();
    }
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select Test Equipment">
      <ul>
        {testEquipment.map((equipment) => (
          <li key={equipment._id} className="flex justify-between mb-2">
            {equipment.ctrlNumber} - {equipment.model}
            <button
              className="text-blue-500 hover:underline"
              onClick={() => onAdd(equipment._id)}
            >
              Add
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  );
};
export default AddTestEquipmentModal;