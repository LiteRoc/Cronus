import React, { useState } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSync: (diOrUdi: string) => void;
}

const SyncFromFDAModal: React.FC<Props> = ({ isOpen, onClose, onSync }) => {
  const [input, setInput] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-md max-w-sm w-full space-y-4">
        <h2 className="text-lg font-semibold">Sync Template with FDA</h2>

        <input
          type="text"
          placeholder="Enter DI or UDI"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="border p-2 w-full rounded"
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={() => onSync(input)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            🔄 Sync
          </button>
        </div>
      </div>
    </div>
  );
};

export default SyncFromFDAModal;