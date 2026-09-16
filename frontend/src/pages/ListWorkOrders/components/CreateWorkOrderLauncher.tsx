// src/pages/ListWorkOrders/components/CreateWorkOrderLauncher.tsx

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui";
import AssetPickerModal from "../modals/AssetPickerModal";
import CreateWorkOrderModal from "../modals/CreateWorkOrderModal";
import { Asset, WorkOrder, WorkOrderCreatePayload } from "@/types";
import { addWorkOrder } from "@/services";

type Props = { onCreated?: (wo: WorkOrder) => void };

export default function CreateWorkOrderLauncher({ onCreated }: Props) {

  const [pickerOpen, setPickerOpen] = useState(false);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const openFlow = () => setPickerOpen(true);
  const handleSelect = (a: Asset) => { setPickerOpen(false); setAsset(a); setCreateOpen(true); };

  const handleCreate = async (payload: WorkOrderCreatePayload) => {
    // The server defaults assignment only when the actor is Facility-eligible.
    const wo = await addWorkOrder(payload);
    onCreated?.(wo);
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={openFlow} variant="default" size="md">
          <Plus className="mr-2 h-4 w-4" />
            New Work Order
        </Button>
      </div>
      
      <AssetPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelect}
      />

      {createOpen && asset && (
        <CreateWorkOrderModal
          asset={asset}
          onClose={() => { setCreateOpen(false); setAsset(null); }}
          onCreate={handleCreate}
        />
      )}
    </>
  );
}