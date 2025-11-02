//src/pages/EditWorkOrder/modals/AddTravelTimeModal.tsx

import React from "react";
import Modal from "@/components/Modal"; // Assuming a shared Modal component

const AddTravelTimeModal: React.FC<{
  travelTime: number;
  travelNote: string;
  setTravelTime: (time: number) => void;
  setTravelNote: (note: string) => void;
  onClose: () => void;
}> = ({ travelTime, travelNote, setTravelTime, setTravelNote, onClose }) => {
  
  return (
    <Modal isOpen={true} onClose={onClose} title="Add Travel Time">
      <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
        <div>
          <label htmlFor="travelTime">Travel Time (minutes)</label>
          <input
            type="number"
            id="travelTime"
            value={travelTime}
            onChange={(e) => setTravelTime(Number(e.target.value))}
            className="border p-2 rounded w-full"
          />
          <textarea
            value={travelNote}
            onChange={(e) => setTravelNote(e.target.value)}
            placeholder="Travel Note (optional)"
          />
        </div>
        <div className="flex space-x-4">
          <button
            type="button"
            onClick={onClose}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Done
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddTravelTimeModal;