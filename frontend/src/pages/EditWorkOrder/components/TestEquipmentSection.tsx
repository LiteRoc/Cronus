import React from "react";
import { Asset } from "../../../types/types";

interface Props {
  testEquipment: Asset[];
}

const TestEquipmentSection: React.FC<Props> = ({ testEquipment }) => {
  if (!testEquipment || testEquipment.length === 0) return null;

  return (
  <div className="mt-6">
    <h3 className="text-lg font-semibold text-gray-800">Test Equipment Used</h3>
    <ul className="mt-2 list-disc list-inside text-gray-700">
      {testEquipment.map((eq) => (
        <li key={eq._id}>
          {eq.ctrlNumber} — {eq.model} ({eq.manufacturer})
        </li>
      ))}
    </ul>
  </div>
  );
};

export default TestEquipmentSection;