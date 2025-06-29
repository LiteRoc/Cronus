import React from "react";
import { PartsUsed } from "../../../types/types";

interface Props {
  partsUsed: PartsUsed[];
  onEditPart?: (partId: string, updates: Partial<{ quantity: number }>) => void;
  onDeletePart?: (partId: string) => void;
}

const PartsUsedSection: React.FC<Props> = ({ partsUsed, onEditPart, onDeletePart }) => {
  if (!partsUsed || partsUsed.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold border-t pt-4">Parts Used</h2>
      <table className="w-full border border-gray-300 mt-2">
        <thead className="bg-cactus text-black">
          <tr>
            <th className="border p-2">Part Number</th>
            <th className="border p-2">Description</th>
            <th className="border p-2">Quantity</th>
          </tr>
        </thead>
        <tbody>
          {partsUsed.map((part, index) => (
            <tr key={index}>
              <td className="border p-2">{part.partId?.partNumber || "—"}</td>
              <td className="border p-2">{part.partId?.description || "—"}</td>
              <td className="border p-2">
                <input
                  type="number"
                  value={part.quantity}
                  onChange={(e) =>
                    onEditPart?.(part.partId._id, { quantity: Number(e.target.value)})
                  }
                  className="border rounded px-2 py-1 w-full"
                  />
              </td>
              {/* <td className="border p-2">{part.quantity}</td> */}
              <td className="border p-2">
                  <button
                    onClick={() => onDeletePart?.(part.partId._id)}
                    className="text-red-500 hover:underline"
                    >
                      Delete
                    </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PartsUsedSection;