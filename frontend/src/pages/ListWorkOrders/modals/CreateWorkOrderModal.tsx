import React, { useState } from "react";
import { Label, Input, Select, Textarea } from "@/components/ui";
import Modal from "../../../components/Modal";
import { Asset, WorkOrderCreatePayload } from "@/types";
import { useUser } from "../../../context/UserContext";

interface CreateWorkOrderModalProps {
  asset: Asset | null;
  onClose: () => void;
  onCreate: (payload: WorkOrderCreatePayload) => Promise<void>;
}

type LocalState = WorkOrderCreatePayload & { asset: Asset | null };

const CreateWorkOrderModal: React.FC<CreateWorkOrderModalProps> = ({
  asset,
  onClose,
  onCreate,
}) => {
  const { user } = useUser(); // Access the logged-in user's information
  const userId = (user as any)?._id || (user as any)?.id || "";

  if (!asset) return null; // require an asset

  const [form, setForm] = useState<LocalState>({
    description: "",
    scheduledDate: "",
    workOrderType: "Corrective Maintenance",
    priority: "normal",
    asset,                      // keep the object locally for UI
    assetId: asset._id,         // ✅ satisfy LocalState (create payload needs this)
    assignedTo: userId || undefined, // store a string id (not a user object)
  });

  /*const [newWorkOrder, setNewWorkOrder] = useState<Partial<WorkOrder & { asset: Asset | null }>>({
    description: "",
    scheduledDate: "",
    workOrderType: "Corrective Maintenance",
    asset: asset || null, // Set the asset object here
    assignedTo: userId
  });*/

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!form.asset || !form.assignedTo) {
      alert("An asset must be associated with the work order.");
      return;
    }

    try {
      await onCreate(form);
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
          <Label htmlFor="description" required>Description</Label>
          <Textarea
            id="description"
            name="description"
            value={form.description}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <Label htmlFor="scheduledDate" required>Scheduled Date</Label>
          <Input
            type="date"
            id="scheduledDate"
            name="scheduledDate"
            value={form.scheduledDate || ""}
            onChange={handleInputChange}
            required
          />
        </div>

        <div className="form-group">
          <Label htmlFor="workOrderType" required>Work Order Type</Label>
          <Select
            id="workOrderType"
            name="workOrderType"
            value={form.workOrderType || ""}
            onChange={handleInputChange}
          >
            <option value="Corrective Maintenance">Corrective Maintenance</option>
            <option value="Planned Maintenance">Planned Maintenance</option>
          </Select>
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