// src/pages/ListWorkOrders/components/CreateWorkOrderLauncher.tsx

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui";
import AssetPickerModal from "../modals/AssetPickerModal";
import CreateWorkOrderModal from "../modals/CreateWorkOrderModal";
import { Asset, WorkOrder, WorkOrderCreatePayload } from "@/types";
import { addWorkOrder } from "@/services";
import { useUser } from "@/context/UserContext";

type Props = { onCreated?: (wo: WorkOrder) => void };

export default function CreateWorkOrderLauncher({ onCreated }: Props) {
  const { user } = useUser();
  const userId = (user as any)?._id || (user as any)?.id;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const openFlow = () => setPickerOpen(true);
  const handleSelect = (a: Asset) => { setPickerOpen(false); setAsset(a); setCreateOpen(true); };

  const handleCreate = async (payload: WorkOrderCreatePayload) => {
    // ensure assignedTo defaults to current user
    const finalPayload = { ...payload, assignedTo: payload.assignedTo || userId };
    const wo = await addWorkOrder(finalPayload);
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