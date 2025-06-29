import React, { useState } from "react";
import CreateWorkOrderModal from "../../Dashboard/modals/CreateWorkOrderModal";
import { Asset, WorkOrder } from "../../../types/types";
import { handleCreateWorkOrder } from "../../../utils/WorkOrderUtils";

interface Props {
  asset: Asset;
  onCreated?: (newWorkOrder: WorkOrder) => void;
}

const CreateWorkOrderButtonWithModal: React.FC<Props> = ({ asset, onCreated }) => {
  const [showModal, setShowModal] = useState(false);

  const handleClose = () => setShowModal(false);

  return (
    <>
      <button
        type="button"
        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        onClick={() => setShowModal(true)}
      >
        Create Work Order
      </button>

      {showModal && (
        <CreateWorkOrderModal
          asset={asset}
          onClose={handleClose}
          onCreate={async (newWorkOrder) => {
            handleCreateWorkOrder(
              newWorkOrder,
              (created) => {
                console.log("✅ Work order created:", created);
                setShowModal(false);
                onCreated?.(created);
              },
              (error) => {
                console.error("❌ Error creating work order:", error);
                alert("Failed to create work order. Please try again.");
              }
            );
          }}
        />
      )}
    </>
  );
};

export default CreateWorkOrderButtonWithModal;