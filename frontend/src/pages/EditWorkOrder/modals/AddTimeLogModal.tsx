//src/pages/EditWorkOrder/modals/AddTimeLogModal.tsx

import React, { useState } from "react";
import Modal from "@/components/Modal"; // Assuming a shared Modal component
import AddTravelTimeModal from "./AddTravelTimeModal";
import { NewTimeLog, NewTravelLog } from "@/types";
import { showWarning } from "@/utils/toastUtils";

interface AddTimeLogModalProps {
  onAddTime: (log: NewTimeLog) => Promise<void>;
  onAddTravel: (log: NewTravelLog) => Promise<void>;
  onClose: () => void;
}

const AddTimeLogModal: React.FC<AddTimeLogModalProps> = ({ onAddTime, onAddTravel, onClose }) => {
  const [timeSpent, setTimeSpent] = useState<number>(0);
  const [description, setDescription] = useState<string>("");
  const [isTravelTimeModalOpen, setIsTravelTimeModalOpen] = useState<boolean>(false);
  const [travelTime, setTravelTime] = useState<number>(0);
  const [travelNote, setTravelNote] = useState<string>('');

  const handleSave = async () => {
    if (!timeSpent || timeSpent <= 0 || !description) {
      showWarning("Time spent must be a positive number.");
      return;
    }
    
    const timeLog = { timeSpent, description };
    await onAddTime(timeLog);

    // If travel time was entered, save travel log
    if (travelTime > 0) {
      const travelLog = { travelTime, note: travelNote || "" };
      await onAddTravel(travelLog);
    }

    onClose();
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Add Time Log">
      <div className="space-y-4">
        <div>
          <label htmlFor="timeSpent">Time Spent (minutes)</label>
          <input
            type="number"
            id="timeSpent"
            value={timeSpent}
            onChange={(e) => setTimeSpent(Number(e.target.value))}
            className="border p-2 rounded w-full"
          />
        </div>
        <div>
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border p-2 rounded w-full"
          ></textarea>
        </div>
        <button
          type="button"
          onClick={() => setIsTravelTimeModalOpen(true)}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
        >
          Add Travel Time
        </button>
        <div className="flex space-x-4">
          <button
            type="button"
            onClick={handleSave}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onClose}
            className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Cancel
          </button>
        </div>
      </div>

      {isTravelTimeModalOpen && (
        <AddTravelTimeModal
          travelTime={travelTime}
          travelNote={travelNote}
          setTravelTime={setTravelTime}
          setTravelNote={setTravelNote}
          onClose={() => setIsTravelTimeModalOpen(false)}
        />
      )}
    </Modal>

  );
};

export default AddTimeLogModal;