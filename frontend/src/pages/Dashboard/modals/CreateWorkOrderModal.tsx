import React, { useState } from "react";
import Modal from "../../../components/Modal";
import { WorkOrder, Asset } from "../../../types/types";
import { useUser } from "../../../context/UserContext";

interface CreateWorkOrderModalProps {
  asset: Asset | null;
  onClose: () => void;
  onCreate: (newWorkOrder: WorkOrder) => Promise<void>;
}

const CreateWorkOrderModal: React.FC<CreateWorkOrderModalProps> = ({
  asset,
  onClose,
  onCreate,
}) => {
  const { user } = useUser(); // Access the logged-in user's information

  const [newWorkOrder, setNewWorkOrder] = useState<Partial<WorkOrder & { asset: Asset | null }>>({
    description: "",
    scheduledDate: "",
    workOrderType: "Corrective Maintenance",
    asset: asset || null, // Set the asset object here
    assignedTo: user
      ? { _id: user.id, username: user.name, email: user.email }
      : undefined, // Adjust to match AssignedTo type
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setNewWorkOrder((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!newWorkOrder.asset || !newWorkOrder.assignedTo) {
      alert("An asset must be associated with the work order.");
      return;
    }

    try {
      await onCreate({
        ...newWorkOrder,
        assetId: newWorkOrder.asset._id, // Pass the asset ID to the backend
        assignedTo: newWorkOrder.assignedTo ? newWorkOrder.assignedTo._id : undefined, // Ensure 'assignedTo' is sent
      } as unknown as WorkOrder);
      onClose(); // Close modal after successful creation
    } catch (error) {
      console.error("Error creating work order:", error);
      alert("Failed to create work order. Please try again.");
    }
  };

  if (!asset) return null;

  return (
    <Modal isOpen={!!asset} onClose={onClose} className="w-3/4 max-w-3xl">
      <h2>Create Work Order</h2>
      <div>
        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={newWorkOrder.description}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="scheduledDate">Scheduled Date</label>
          <input
            type="date"
            id="scheduledDate"
            name="scheduledDate"
            value={newWorkOrder.scheduledDate || ""}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="workOrderType">Work Order Type</label>
          <select
            id="workOrderType"
            name="workOrderType"
            value={newWorkOrder.workOrderType || ""}
            onChange={handleInputChange}
          >
            <option value="Corrective Maintenance">Corrective Maintenance</option>
            <option value="Planned Maintenance">Planned Maintenance</option>
          </select>
        </div>

        <div className="modal-actions">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} className="btn-primary">
            Create
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default CreateWorkOrderModal;