import React, { useState } from "react";
import Modal from "../../../components/Modal"; // Assuming a shared Modal component
import AddTravelTimeModal from "./AddTravelTimeModal";

const AddTimeLogModal: React.FC<{ onSave: (timeLog: any, travelLog?: any) => void; onClose: () => void }> = ({ onSave, onClose }) => {
  const [timeSpent, setTimeSpent] = useState<number>(0);
  const [description, setDescription] = useState<string>("");
  const [isTravelTimeModalOpen, setIsTravelTimeModalOpen] = useState<boolean>(false);
  const [travelTime, setTravelTime] = useState<number>(0);

  const handleSave = () => {
    if (!timeSpent || timeSpent <= 0) {
      alert("Time spent must be a positive number.");
      return;
    }

    if (!description) {
      alert("Description cannot be emtpy.");
      return;
    }
    
    const timeLog = { timeSpent, description };
    const travelLog = travelTime > 0 ? { travelTime } : undefined;
    onSave(timeLog, travelLog);
    onClose();
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Add Time Log">
      <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
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
      </form>
      {isTravelTimeModalOpen && (
        <AddTravelTimeModal
          travelTime={travelTime}
          setTravelTime={setTravelTime}
          onClose={() => setIsTravelTimeModalOpen(false)}
        />
      )}
    </Modal>
  );
};

export default AddTimeLogModal;