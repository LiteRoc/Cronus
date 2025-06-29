import React, { useState, useEffect } from "react";
import Modal from "../../../components/Modal"
import { Asset } from "../../../types/types";
import { getTestEquip } from "../../../services/assetAPI";

interface AddTestEquipmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (testEquipmentId: string) => void;
}

const AddTestEquipmentModal: React.FC<AddTestEquipmentModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [testEquipment, setTestEquipment] = useState<Asset[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchTestEquipment();
    }
  }, [isOpen]);

  const fetchTestEquipment = async () => {
      try {
        const response = await getTestEquip();
        setTestEquipment(response);
      } catch (error) {
        console.error("Error fetching test equipment:", error);
      }
    };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select Test Equipment">
      <ul>
        {testEquipment.map((equipment) => (
          <li key={equipment._id} className="flex justify-between mb-2">
            {equipment.ctrlNumber} - {equipment.model}
            <button
              className="text-blue-500 hover:underline"
              onClick={() => onSave(equipment._id)}
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